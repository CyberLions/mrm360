import { 
  Client, 
  GatewayIntentBits, 
  Guild, 
  GuildChannel, 
  GuildMember, 
  Role, 
  ChannelType, 
  PermissionFlagsBits,
  TextChannel,
  CategoryChannel,
  GuildBasedChannel,
  Message,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  ApplicationCommand,
  ApplicationCommandData,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  EmbedBuilder,
  SnowflakeUtil
} from 'discord.js';
import { DiscordChannel, DiscordRole, DiscordPermission } from '@/types';
import { logger } from '@/utils/logger';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export interface RoleReactionMapping {
  emoji: string;
  roleId: string;
  description: string;
}

export class DiscordBotService {
  private client: Client;
  private guild: Guild | null = null;
  private botToken: string;
  private guildId: string;
  private categoryId: string;
  private isReady: boolean = false;
  private roleReactionMappings: RoleReactionMapping[] = [];
  private prisma: PrismaClient;
  private eventDedupRedis: Redis | null = null;
  // Guards against a single interaction/member-join being handled more than once
  // (e.g. duplicate gateway dispatches), which previously caused duplicate sends.
  private processedInteractionIds: Set<string> = new Set();
  private recentWelcomes: Map<string, number> = new Map();

  constructor(config: {
    botToken: string;
    guildId: string;
    categoryId: string;
  }) {
    this.botToken = config.botToken;
    this.guildId = config.guildId;
    this.categoryId = config.categoryId;
    this.prisma = new PrismaClient();



    // Create Discord client with necessary intents.
    // `rest.timeout` is raised well above the 15s default: a slow POST that
    // crosses the default timeout is aborted and *retried* by @discordjs/rest,
    // and message-create is not idempotent, so a transient latency spike would
    // otherwise post the same message 2-3 times (see sendWelcomeMessage).
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
      ],
      rest: {
        timeout: 60_000
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      logger.info(`Discord bot logged in as ${this.client.user?.tag}`);
      logger.info('Ready event fired, initializing guild...');
      this.initializeGuild();
    });

    this.client.on('messageReactionAdd', this.handleReactionAdd.bind(this));
    this.client.on('messageReactionRemove', this.handleReactionRemove.bind(this));
    this.client.on('interactionCreate', this.handleInteraction.bind(this));
    this.client.on('guildMemberAdd', this.handleGuildMemberAdd.bind(this));

    this.client.on('error', (error) => {
      logger.error('Discord bot error:', error);
    });

    this.client.on('disconnect', () => {
      logger.warn('Discord bot disconnected');
      this.isReady = false;
    });
  }

  private async initializeGuild(): Promise<void> {
    try {
      logger.info(`Attempting to fetch guild with ID: ${this.guildId}`);
      logger.info(`Available guilds: ${this.client.guilds.cache.map(g => `${g.name} (${g.id})`).join(', ')}`);
      
      this.guild = await this.client.guilds.fetch(this.guildId);
      this.isReady = true;
      logger.info(`Discord bot connected to guild: ${this.guild.name}`);
      
      // Register slash commands
      await this.registerSlashCommands();
    } catch (error) {
      logger.error(`Failed to initialize Discord guild ${this.guildId}:`, error);
      throw new Error(`Failed to connect to Discord guild: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async registerSlashCommands(): Promise<void> {
    try {
      logger.info('Registering slash commands...');
      
      const commands: ApplicationCommandData[] = [
        {
          name: 'send-rules',
          description: 'Send the server rules to the current channel',
          type: ApplicationCommandType.ChatInput
        },
        {
          name: 'send-interests',
          description: 'Send the role selection message with buttons',
          type: ApplicationCommandType.ChatInput
        },
        {
          name: 'send-resources',
          description: 'Send cybersecurity learning resources organized by category',
          type: ApplicationCommandType.ChatInput
        },
        {
          name: 'set-new-users',
          description: 'Set the new users channel for the server',
          type: ApplicationCommandType.ChatInput
        }
      ];

      // Register commands for the specific guild
      await this.guild!.commands.set(commands);
      
      logger.info('Slash commands registered successfully');
    } catch (error) {
      logger.error('Error registering slash commands:', error);
    }
  }

  async connect(): Promise<void> {
    if (this.isReady) return;
    
    try {
      logger.info('Attempting to connect to Discord...');
      logger.info(`Bot token length: ${this.botToken.length}`);
      logger.info(`Guild ID: ${this.guildId}`);
      logger.info(`Category ID: ${this.categoryId}`);
      
      // Wait for the ready event before proceeding
      const readyPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord bot ready event timeout'));
        }, 30000); // 30 second timeout
        
        this.client!.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        this.client!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
      await this.client!.login(this.botToken);
      logger.info('Successfully logged in to Discord, waiting for ready event...');
      
      await readyPromise;
      logger.info('Discord bot is ready and connected to guild');
    } catch (error) {
      logger.error('Failed to connect Discord bot:', error);
      throw new Error(`Failed to connect Discord bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.destroy();
      if (this.eventDedupRedis) {
        await this.eventDedupRedis.quit();
        this.eventDedupRedis = null;
      }
      this.isReady = false;
      this.guild = null;
      logger.info('Discord bot disconnected');
    } catch (error) {
      logger.error('Error disconnecting Discord bot:', error);
    }
  }

  private ensureReady(): void {
    if (!this.isReady) {
      throw new Error('Discord bot is not ready. Call connect() first.');
    }
    
    if (!this.guild) {
      throw new Error('Discord bot is not connected to guild. Call connect() first.');
    }
  }

  async createChannel(name: string, categoryId?: string): Promise<DiscordChannel> {
    try {
      this.ensureReady();
      logger.info(`Creating Discord channel: ${name}`);



      const targetCategoryId = categoryId || this.categoryId;
      const category = await this.guild!.channels.fetch(targetCategoryId) as CategoryChannel;

      if (!category || category.type !== ChannelType.GuildCategory) {
        throw new Error(`Invalid category ID: ${targetCategoryId}`);
      }

      const channel = await this.guild!.channels.create({
        name: name.toLowerCase().replace(/\s+/g, '-'),
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: []
      });

      const discordChannel: DiscordChannel = {
        id: channel.id,
        name: channel.name,
        categoryId: targetCategoryId,
        permissions: []
      };

      logger.info(`Successfully created Discord channel: ${name} with ID: ${channel.id}`);
      return discordChannel;
    } catch (error) {
      logger.error(`Error creating Discord channel ${name}:`, error);
      throw new Error(`Failed to create Discord channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateChannel(channelId: string, updates: Partial<DiscordChannel>): Promise<DiscordChannel> {
    try {
      this.ensureReady();
      logger.info(`Updating Discord channel: ${channelId}`);



      const channel = await this.guild!.channels.fetch(channelId) as GuildBasedChannel;
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.categoryId) updateData.parent = updates.categoryId;

      await channel.edit(updateData);

      const updatedChannel: DiscordChannel = {
        id: channel.id,
        name: channel.name,
        categoryId: updates.categoryId || this.categoryId,
        permissions: updates.permissions || []
      };

      logger.info(`Successfully updated Discord channel: ${channelId}`);
      return updatedChannel;
    } catch (error) {
      logger.error(`Error updating Discord channel ${channelId}:`, error);
      throw new Error(`Failed to update Discord channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteChannel(channelId: string): Promise<void> {
    try {
      this.ensureReady();
      logger.info(`Deleting Discord channel: ${channelId}`);



      const channel = await this.guild!.channels.fetch(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      await channel.delete();
      logger.info(`Successfully deleted Discord channel: ${channelId}`);
    } catch (error) {
      logger.error(`Error deleting Discord channel ${channelId}:`, error);
      throw new Error(`Failed to delete Discord channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createRole(name: string, permissions: string[] = []): Promise<DiscordRole> {
    try {
      this.ensureReady();
      logger.info(`Creating Discord role: ${name}`);



      // Convert permission strings to Discord permission flags
      const permissionFlags = this.convertPermissionsToFlags(permissions);

      const role = await this.guild!.roles.create({
        name,
        permissions: permissionFlags,
        reason: 'Team provisioning role creation'
      });

      const discordRole: DiscordRole = {
        id: role.id,
        name: role.name,
        permissions: permissions,
        members: []
      };

      logger.info(`Successfully created Discord role: ${name} with ID: ${role.id}`);
      return discordRole;
    } catch (error) {
      logger.error(`Error creating Discord role ${name}:`, error);
      throw new Error(`Failed to create Discord role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateRole(roleId: string, updates: Partial<DiscordRole>): Promise<DiscordRole> {
    try {
      this.ensureReady();
      logger.info(`Updating Discord role: ${roleId}`);



      const role = await this.guild!.roles.fetch(roleId);
      if (!role) {
        throw new Error(`Role not found: ${roleId}`);
      }

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.permissions) {
        updateData.permissions = this.convertPermissionsToFlags(updates.permissions);
      }

      await role.edit(updateData);

      const updatedRole: DiscordRole = {
        id: role.id,
        name: role.name,
        permissions: updates.permissions || [],
        members: updates.members || []
      };

      logger.info(`Successfully updated Discord role: ${roleId}`);
      return updatedRole;
    } catch (error) {
      logger.error(`Error updating Discord role ${roleId}:`, error);
      throw new Error(`Failed to update Discord role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteRole(roleId: string): Promise<void> {
    try {
      this.ensureReady();
      logger.info(`Deleting Discord role: ${roleId}`);



      const role = await this.guild!.roles.fetch(roleId);
      if (!role) {
        throw new Error(`Role not found: ${roleId}`);
      }

      await role.delete('Team provisioning role deletion');
      logger.info(`Successfully deleted Discord role: ${roleId}`);
    } catch (error) {
      logger.error(`Error deleting Discord role ${roleId}:`, error);
      throw new Error(`Failed to delete Discord role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async setChannelPermissions(channelId: string, permissions: DiscordPermission[]): Promise<void> {
    try {
      this.ensureReady();
      logger.info(`Setting permissions for Discord channel: ${channelId}`);



      const channel = await this.guild!.channels.fetch(channelId) as GuildBasedChannel;
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      for (const permission of permissions) {
        const role = await this.guild!.roles.fetch(permission.roleId);
        if (role && 'permissionOverwrites' in channel) {
          const permissionFlags = this.convertPermissionsToFlags(permission.permissions);
          const permissionOverwrites: any = { ViewChannel: true };
          if (permissionFlags & PermissionFlagsBits.SendMessages) permissionOverwrites.SendMessages = true;
          if (permissionFlags & PermissionFlagsBits.ReadMessageHistory) permissionOverwrites.ReadMessageHistory = true;
          if (permissionFlags & PermissionFlagsBits.AttachFiles) permissionOverwrites.AttachFiles = true;
          if (permissionFlags & PermissionFlagsBits.EmbedLinks) permissionOverwrites.EmbedLinks = true;
          if (permissionFlags & PermissionFlagsBits.UseExternalEmojis) permissionOverwrites.UseExternalEmojis = true;
          if (permissionFlags & PermissionFlagsBits.AddReactions) permissionOverwrites.AddReactions = true;
          if (permissionFlags & PermissionFlagsBits.ManageMessages) permissionOverwrites.ManageMessages = true;
          if (permissionFlags & PermissionFlagsBits.ManageChannels) permissionOverwrites.ManageChannels = true;
          if (permissionFlags & PermissionFlagsBits.ManageRoles) permissionOverwrites.ManageRoles = true;
          if (permissionFlags & PermissionFlagsBits.Administrator) permissionOverwrites.Administrator = true;
          
          await (channel as any).permissionOverwrites.create(role, permissionOverwrites);
        }
      }

      logger.info(`Successfully set permissions for Discord channel: ${channelId}`);
    } catch (error) {
      logger.error(`Error setting permissions for Discord channel ${channelId}:`, error);
      throw new Error(`Failed to set Discord channel permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async assignRoleToUsers(roleId: string, userIds: string[]): Promise<void> {
    try {
      this.ensureReady();
      logger.info(`Assigning role ${roleId} to ${userIds.length} users`);

      const role = await this.guild!.roles.fetch(roleId);
      if (!role) {
        throw new Error(`Role not found: ${roleId}`);
      }

      for (const userId of userIds) {
        try {
          const member = await this.guild!.members.fetch(userId);
          await member.roles.add(role);
        } catch (memberError) {
          logger.warn(`Failed to assign role to user ${userId}:`, memberError);
        }
      }

      logger.info(`Successfully assigned role ${roleId} to users`);
    } catch (error) {
      logger.error(`Error assigning role ${roleId} to users:`, error);
      throw new Error(`Failed to assign Discord role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    try {
      this.ensureReady();
      logger.info(`Assigning role ${roleId} to user ${userId}`);

      const role = await this.guild!.roles.fetch(roleId);
      if (!role) {
        throw new Error(`Role not found: ${roleId}`);
      }

      const member = await this.guild!.members.fetch(userId);
      await member.roles.add(role);

      logger.info(`Successfully assigned role ${roleId} to user ${userId}`);
    } catch (error) {
      logger.error(`Error assigning role ${roleId} to user ${userId}:`, error);
      throw new Error(`Failed to assign Discord role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    try {
      this.ensureReady();
      logger.info(`Removing role ${roleId} from user ${userId}`);

      const role = await this.guild!.roles.fetch(roleId);
      if (!role) {
        throw new Error(`Role not found: ${roleId}`);
      }

      const member = await this.guild!.members.fetch(userId);
      await member.roles.remove(role);

      logger.info(`Successfully removed role ${roleId} from user ${userId}`);
    } catch (error) {
      logger.error(`Error removing role ${roleId} from user ${userId}:`, error);
      throw new Error(`Failed to remove Discord role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async removeRoleFromUsers(roleId: string, userIds: string[]): Promise<void> {
    try {
      this.ensureReady();
      logger.info(`Removing role ${roleId} from ${userIds.length} users`);

      const role = await this.guild!.roles.fetch(roleId);
      if (!role) {
        throw new Error(`Role not found: ${roleId}`);
      }

      for (const userId of userIds) {
        try {
          const member = await this.guild!.members.fetch(userId);
          await member.roles.remove(role);
        } catch (memberError) {
          logger.warn(`Failed to remove role from user ${userId}:`, memberError);
        }
      }

      logger.info(`Successfully removed role ${roleId} from users`);
    } catch (error) {
      logger.error(`Error removing role ${roleId} from users:`, error);
      throw new Error(`Failed to remove Discord role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async batchUpdateRoles(userId: string, targetRoles: string[], rolesToRemove: string[]): Promise<void> {
    try {
      this.ensureReady();
      logger.info(`Batch updating roles for user ${userId}`, {
        targetRoles,
        rolesToRemove
      });

      const member = await this.guild!.members.fetch(userId);
      
      // Remove roles that are not in target roles
      for (const roleId of rolesToRemove) {
        try {
          const role = await this.guild!.roles.fetch(roleId);
          if (role && member.roles.cache.has(roleId)) {
            await member.roles.remove(role);
            logger.info(`Removed role ${roleId} from user ${userId}`);
          }
        } catch (roleError) {
          logger.warn(`Failed to remove role ${roleId} from user ${userId}:`, roleError);
        }
      }

      // Add target roles
      for (const roleId of targetRoles) {
        try {
          const role = await this.guild!.roles.fetch(roleId);
          if (role && !member.roles.cache.has(roleId)) {
            await member.roles.add(role);
            logger.info(`Added role ${roleId} to user ${userId}`);
          }
        } catch (roleError) {
          logger.warn(`Failed to add role ${roleId} to user ${userId}:`, roleError);
        }
      }

      logger.info(`Successfully completed batch role update for user ${userId}`);
    } catch (error) {
      logger.error(`Error batch updating roles for user ${userId}:`, error);
      throw new Error(`Failed to batch update Discord roles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getChannel(channelId: string): Promise<DiscordChannel> {
    try {
      this.ensureReady();
      logger.info(`Getting Discord channel: ${channelId}`);



      const channel = await this.guild!.channels.fetch(channelId) as GuildBasedChannel;
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const discordChannel: DiscordChannel = {
        id: channel.id,
        name: channel.name,
        categoryId: channel.parentId || this.categoryId,
        permissions: []
      };

      return discordChannel;
    } catch (error) {
      logger.error(`Error getting Discord channel ${channelId}:`, error);
      throw new Error(`Failed to get Discord channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRole(roleId: string): Promise<DiscordRole> {
    try {
      this.ensureReady();
      logger.info(`Getting Discord role: ${roleId}`);



      const role = await this.guild!.roles.fetch(roleId);
      if (!role) {
        throw new Error(`Role not found: ${roleId}`);
      }

      const discordRole: DiscordRole = {
        id: role.id,
        name: role.name,
        permissions: this.convertFlagsToPermissions(BigInt(role.permissions.bitfield)),
        members: []
      };

      return discordRole;
    } catch (error) {
      logger.error(`Error getting Discord role ${roleId}:`, error);
      throw new Error(`Failed to get Discord role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async channelExists(name: string): Promise<boolean> {
    try {
      this.ensureReady();
      logger.info(`Checking if Discord channel exists: ${name}`);



      const channels = await this.guild!.channels.fetch();
      const channelExists = channels.some(channel => 
        channel && channel.name.toLowerCase() === name.toLowerCase()
      );

      return channelExists;
    } catch (error) {
      logger.error(`Error checking if Discord channel exists ${name}:`, error);
      throw new Error(`Failed to check Discord channel existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async roleExists(name: string): Promise<boolean> {
    try {
      this.ensureReady();
      logger.info(`Checking if Discord role exists: ${name}`);



      const roles = await this.guild!.roles.fetch();
      const roleExists = roles.some(role => 
        role.name.toLowerCase() === name.toLowerCase()
      );

      return roleExists;
    } catch (error) {
      logger.error(`Error checking if Discord role exists ${name}:`, error);
      throw new Error(`Failed to check Discord role existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createCategory(name: string): Promise<string> {
    try {
      this.ensureReady();
      logger.info(`Creating Discord category: ${name}`);



      const category = await this.guild!.channels.create({
        name: name.toLowerCase().replace(/\s+/g, '-'),
        type: ChannelType.GuildCategory
      });

      logger.info(`Successfully created Discord category: ${name} with ID: ${category.id}`);
      return category.id;
    } catch (error) {
      logger.error(`Error creating Discord category ${name}:`, error);
      throw new Error(`Failed to create Discord category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async moveChannelToCategory(channelId: string, categoryId: string): Promise<void> {
    try {
      this.ensureReady();
      logger.info(`Moving Discord channel ${channelId} to category ${categoryId}`);



      const channel = await this.guild!.channels.fetch(channelId) as GuildBasedChannel;
      const category = await this.guild!.channels.fetch(categoryId) as CategoryChannel;

      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      if (!category || category.type !== ChannelType.GuildCategory) {
        throw new Error(`Invalid category ID: ${categoryId}`);
      }

      if ('edit' in channel) {
        await (channel as any).edit({ parent: category });
      }
      logger.info(`Successfully moved Discord channel ${channelId} to category ${categoryId}`);
    } catch (error) {
      logger.error(`Error moving Discord channel ${channelId} to category ${categoryId}:`, error);
      throw new Error(`Failed to move Discord channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private convertPermissionsToFlags(permissions: string[]): bigint {
    let flags = 0n;
    
    for (const permission of permissions) {
      switch (permission.toLowerCase()) {
        case 'view_channel':
          flags |= PermissionFlagsBits.ViewChannel;
          break;
        case 'send_messages':
          flags |= PermissionFlagsBits.SendMessages;
          break;
        case 'read_message_history':
          flags |= PermissionFlagsBits.ReadMessageHistory;
          break;
        case 'attach_files':
          flags |= PermissionFlagsBits.AttachFiles;
          break;
        case 'embed_links':
          flags |= PermissionFlagsBits.EmbedLinks;
          break;
        case 'use_external_emojis':
          flags |= PermissionFlagsBits.UseExternalEmojis;
          break;
        case 'add_reactions':
          flags |= PermissionFlagsBits.AddReactions;
          break;
        case 'manage_messages':
          flags |= PermissionFlagsBits.ManageMessages;
          break;
        case 'manage_channels':
          flags |= PermissionFlagsBits.ManageChannels;
          break;
        case 'manage_roles':
          flags |= PermissionFlagsBits.ManageRoles;
          break;
        case 'administrator':
          flags |= PermissionFlagsBits.Administrator;
          break;
      }
    }
    
    return flags;
  }

  private convertFlagsToPermissions(flags: bigint): string[] {
    const permissions: string[] = [];
    
    if (flags & PermissionFlagsBits.ViewChannel) permissions.push('view_channel');
    if (flags & PermissionFlagsBits.SendMessages) permissions.push('send_messages');
    if (flags & PermissionFlagsBits.ReadMessageHistory) permissions.push('read_message_history');
    if (flags & PermissionFlagsBits.AttachFiles) permissions.push('attach_files');
    if (flags & PermissionFlagsBits.EmbedLinks) permissions.push('embed_links');
    if (flags & PermissionFlagsBits.UseExternalEmojis) permissions.push('use_external_emojis');
    if (flags & PermissionFlagsBits.AddReactions) permissions.push('add_reactions');
    if (flags & PermissionFlagsBits.ManageMessages) permissions.push('manage_messages');
    if (flags & PermissionFlagsBits.ManageChannels) permissions.push('manage_channels');
    if (flags & PermissionFlagsBits.ManageRoles) permissions.push('manage_roles');
    if (flags & PermissionFlagsBits.Administrator) permissions.push('administrator');
    
    return permissions;
  }

  async getHealthStatus(): Promise<{ status: string; message: string; details?: any }> {
    try {
      if (!this.isReady) {
        return {
          status: 'unhealthy',
          message: 'Discord bot is not connected'
        };
      }

      if (!this.guild) {
        return {
          status: 'unhealthy',
          message: 'Discord bot is not connected to guild'
        };
      }

      // Test basic operations
      await this.guild.fetch();
      
      return {
        status: 'healthy',
        message: 'Discord bot is connected and operational',
        details: {
          guildName: this.guild.name,
          guildId: this.guild.id,
          botUser: this.client.user?.tag
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Discord bot health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Role Reaction Methods
  setRoleReactionMappings(mappings: RoleReactionMapping[]): void {
    this.roleReactionMappings = mappings;
    logger.info(`Set ${mappings.length} role reaction mappings`);
  }

  async createRoleSelectionMessage(channelId: string): Promise<string> {
    try {
      this.ensureReady();
      
      const channel = await this.guild!.channels.fetch(channelId) as TextChannel;
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      if (this.roleReactionMappings.length === 0) {
        throw new Error('No role reaction mappings configured');
      }

      const messageContent = this.buildRoleSelectionMessage();
      // enforceNonce so a retried POST (see sendWelcomeMessage) can't duplicate
      // this message.
      const message = await channel.send({
        nonce: SnowflakeUtil.generate().toString(),
        enforceNonce: true,
        content: messageContent
      });

      // Add reactions for each role. A failure here (e.g. rate limiting) must
      // not bubble up and fail the job, since a job retry would call this
      // method again and re-send (duplicate) the message that already sent
      // successfully above.
      for (const mapping of this.roleReactionMappings) {
        try {
          await message.react(mapping.emoji);
        } catch (reactionError) {
          logger.error(`Failed to add reaction ${mapping.emoji} to role selection message ${message.id}:`, reactionError);
        }
      }

      logger.info(`Created role selection message in channel ${channelId}`);
      return message.id;
    } catch (error) {
      logger.error(`Error creating role selection message in channel ${channelId}:`, error);
      throw new Error(`Failed to create role selection message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildRoleSelectionMessage(): string {
    let message = '**Role Selection**\n\n';
    message += 'Click the reactions below to get or remove roles:\n\n';
    
    for (const mapping of this.roleReactionMappings) {
      message += `${mapping.emoji} **${mapping.description}**\n`;
    }
    
    message += '\n*Click the reaction to toggle the role*';
    return message;
  }

  private async handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
    try {
      // Ignore bot reactions
      if (user.bot) return;

      const mapping = this.roleReactionMappings.find(m => m.emoji === reaction.emoji.name);
      if (!mapping) return;

      const claimed = await this.claimGatewayEvent(
        `reaction-add:${reaction.message.guildId}:${reaction.message.id}:${user.id}:${reaction.emoji.identifier}`,
        10
      );
      if (!claimed) return;

      const member = await this.guild!.members.fetch(user.id);
      await member.roles.add(mapping.roleId);

      logger.info(`Added role ${mapping.roleId} to user ${user.id} via reaction`);
    } catch (error) {
      logger.error('Error handling reaction add:', error);
    }
  }

  private async handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
    try {
      // Ignore bot reactions
      if (user.bot) return;

      const mapping = this.roleReactionMappings.find(m => m.emoji === reaction.emoji.name);
      if (!mapping) return;

      const claimed = await this.claimGatewayEvent(
        `reaction-remove:${reaction.message.guildId}:${reaction.message.id}:${user.id}:${reaction.emoji.identifier}`,
        10
      );
      if (!claimed) return;

      const member = await this.guild!.members.fetch(user.id);
      await member.roles.remove(mapping.roleId);

      logger.info(`Removed role ${mapping.roleId} from user ${user.id} via reaction`);
    } catch (error) {
      logger.error('Error handling reaction remove:', error);
    }
  }

  private async handleInteraction(interaction: any): Promise<void> {
    // Discord can dispatch the same interaction more than once (e.g. gateway
    // resume replays); ignore anything we've already started handling so we
    // never send a duplicate response for one user action.
    if (this.processedInteractionIds.has(interaction.id)) {
      logger.warn(`Ignoring duplicate interactionCreate dispatch for interaction ${interaction.id}`);
      return;
    }
    this.processedInteractionIds.add(interaction.id);
    setTimeout(() => this.processedInteractionIds.delete(interaction.id), 60_000);

    if (!await this.claimGatewayEvent(`interaction:${interaction.id}`, 60)) {
      return;
    }

    try {
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  }

  // Slash command handlers
  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const { commandName } = interaction;

    switch (commandName) {
      case 'send-rules':
        await this.handleSendRules(interaction);
        break;
      case 'send-interests':
        await this.handleSendInterests(interaction);
        break;
      case 'send-resources':
        await this.handleSendResources(interaction);
        break;
      case 'set-new-users':
        await this.handleSetNewUsers(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown command!', ephemeral: true });
    }
  }

  private async handleButtonInteraction(interaction: any): Promise<void> {
    try {
      const { customId } = interaction;
      
      if (customId.startsWith('role_')) {
        await this.handleRoleButton(interaction);
      }
    } catch (error) {
      logger.error('Error handling button interaction:', error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error processing your selection!', ephemeral: true });
      }
    }
  }

  private async handleSendRules(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check if user has administrator permissions
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({ 
        content: '❌ You need Administrator permissions to use this command.', 
        ephemeral: true 
      });
      return;
    }

    const rulesEmbed = new EmbedBuilder()
      .setTitle('Server Rules')
      .setColor(0x0099ff)
      .addFields(
        { name: 'General Rules', value: '• To be verified as a member, your Discord nickname must contain either your first name or your IRL nickname\n• The member role is used to help mitigate against bots and spam on the server\n• To verify your membership, please message one of the moderators or executive officers\n• No promoting illegal and or unethical behavior. This includes but is not limited to: discussing how to execute real-world cyber attacks, discussing ways to evade authorities, promoting methods of purchasing illicit goods, or other illegal and or unethical behaviors' },
        { name: 'Text Chat Rules', value: '• No spamming or flooding the chat\n• No racist or sexist content\n• No offensive content specifically meant to degrade a culture or subculture\n• No harassment or hazing\n• No adult content\n• No disgusting / offensive images\n• No advertising without moderator / officer permission (or second moderator / officer permission if you are one)\n• No unnecessary use of mentions (@someone / @role)' },
        { name: 'Voice Chat Rules (Inherits from text chat)', value: '• No voice chat surfing or switching channels repeatedly\n• No annoying, loud, or high-pitched sounds\n• You may be removed if your audio quality is bothering other members' },
        { name: 'Category and Channel Descriptions', value: 'Try to post things that correspond with each channel and or category.\n\nUse #role-selection to assign yourself roles to access these categories' },
        { name: 'Important', value: 'Contains channels that members should look at on a regular basis. This category includes the server rules and upcoming announcements for CCSO' },
        { name: 'Resources', value: 'Contains channels that offer helpful content that can everyone can use to learn new things and discover something that they didn\'t know about before\n\nNote: Only Moderators and Executive officers can add resources. if you have found something that you think will benefit everyone, please message one of the moderators / officers to see if they can add the resource you found' },
        { name: 'General', value: 'This is where everyone that joins can message and talk to other people' },
        { name: 'War Room', value: 'This is where everyone who is interested in gaming and can post information regarding that' },
        { name: 'Offense', value: 'This is for people interested in offensive security and our CPTC competition team' },
        { name: 'Defense', value: 'This is for people interested in defensive security and our CCDC competition team' },
        { name: 'CTF Competitions', value: 'This is for people interested in CTFs as well as platforms such as TryHackMe and HackTheBox' },
        { name: 'Member Role Benefits', value: 'Everyone is welcome in our server. We do respect people\'s privacy but we would like to know how to address you formally. The officers have decided to incentivize the member role. The permissions below are only allowed through the member role and are not turned on for default users.' },
        { name: 'File Upload', value: 'You will be able to upload files' },
        { name: 'Embedded Links', value: 'The links that you post will grant automatic embeds. This includes automatically posting an image from a link' },
        { name: 'Create Invites', value: 'You will be able to create invite links to share with your friends who would be interested in joining our server' },
        { name: 'External Emojis and Stickers', value: 'You will be able to add external reactions from other servers you are apart of' },
        { name: 'Mentions', value: 'You will be able to use mentions (please refer back to text chat rules)' }
      )
      .setFooter({ text: 'Please follow these rules to maintain a positive community environment' });

    await interaction.reply({ embeds: [rulesEmbed], ephemeral: false });
  }

  private async handleSendResources(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check if user has administrator permissions
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({ 
        content: '❌ You need Administrator permissions to use this command.', 
        ephemeral: true 
      });
      return;
    }

    try {
      // Top 5 Resources embed
      const top5Embed = new EmbedBuilder()
        .setTitle('🏆 Top 5 Resources')
        .setColor(0x00ff00) // Green
        .setDescription(
          '**🔗 [TryHackMe](https://tryhackme.com/)**\n' +
          'Best platform overall. Provides learning topics such as the basics and more advanced topics within offensive and defensive security. Great for any beginner.\n\n' +
          '**🔗 [TCM Academy](https://academy.tcm-sec.com/)**\n' +
          'Provides good courses that you can get a discount for or completely free. Most of the courses focus on offensive security but they plan on covering more subjects in the future. Some courses are beginner to intermediate level.\n\n' +
          '**🔗 [HackTheBox](https://www.hackthebox.com/)**\n' +
          'Best offensive security platform overall. This is the go to platform when it comes to pen testing. However, they mainly specialize with offensive security and lack defensive content. High learning curve, recommended for intermediates.\n\n' +
          '**🔗 [OverTheWire](https://overthewire.org/)**\n' +
          'Good platform to practice linux skills. Recommended for all beginners and for experienced users to brush up on some things. Also check out its cousin: [UnderTheWire](https://underthewire.tech/)\n\n' +
          '**🔗 [INE](https://ine.com/)**\n' +
          'Provide free learning content. They host training for their eLearnSecurity certifications on the site as well. Beginner level.'
        );

      // Offensive Security Resources embed
      const offensiveEmbed = new EmbedBuilder()
        .setTitle('⚔️ Offensive Security Resources')
        .setColor(0xff0000) // Red
        .setDescription(
          '**🔗 [PortSwigger](https://portswigger.net/web-security)**\n' +
          'Provides an academy for web app pen testing. They are also the creators of BurpSuite.\n\n' +
          '**🔗 [PentesterLab](https://pentesterlab.com/)**\n' +
          'Host a large collection of web app pen testing exercises.\n\n' +
          '**🔗 [JuiceShop](https://owasp.org/www-project-juice-shop/)**\n' +
          'Web app designed for pen testing beginners. This was created by the people behind the OWASP Top 10 framework.\n\n' +
          '**🔗 [CyberSecLabs](https://www.cyberseclabs.co.uk/)**\n' +
          'Another platform similar to TryHackMe. Based in the UK.\n\n' +
          '**🔗 [VulnHub](https://www.vulnhub.com/)**\n' +
          'User created VMs that you can download and hack. Highly recommended for anyone that would like to work with VMs more and or interested in making a home lab.\n\n' +
          '**🔗 [HackThisSite](https://www.hackthissite.org/)**\n' +
          'Site that hosts web pen testing exercises as well.\n\n' +
          '**🔗 [Hack.Me](https://hack.me/)**\n' +
          'Web app pen testing resource.'
        );

      // Defensive Security Resources embed
      const defensiveEmbed = new EmbedBuilder()
        .setTitle('🛡️ Defensive Security Resources')
        .setColor(0x0066ff) // Blue
        .setDescription(
          '**🔗 [Blue Team Labs Online](https://blueteamlabs.online/)**\n' +
          'Only defensive security platform that has been found. They host challenges and exercises that are heavy in incident response and forensics. Made by Security Blue Team.\n\n' +
          '**🔗 [VulnHub](https://www.vulnhub.com/)**\n' +
          'This is listed as defensive since you can download the VMs and try to harden them against the vulnerabilities you exploited. Best path to take is to look for guides on how to exploit the VMs and then research how to patch that certain exploit.\n\n' +
          '**🔗 [Digital Forensics Association](http://www.digitalforensicsassociation.org/evidence-files/)**\n' +
          'Collection of forensic files that are free to use.\n\n' +
          '**🔗 [Metasploitable 2 Hardening Guide](https://akvilekiskis.com/work/metasploitable/index.html)**\n' +
          'Guide on how to patch and fix vulnerabilities on Metasploitable 2. This overall represents what CCDC focuses on.'
        );

      // CTF Resources embed
      const ctfEmbed = new EmbedBuilder()
        .setTitle('🏳️ CTF Resources')
        .setColor(0xffaa00) // Orange
        .setDescription(
          '**🔗 [PicoCTF](https://www.picoctf.org/)**\n' +
          'A free beginner CTF that has a yearly competition. They also have a gymnasium full of all of their previous competitions.\n\n' +
          '**🔗 [National Cyber League](https://nationalcyberleague.org/)**\n' +
          'Beginner CTF that you have to pay for. Provides great challenges to solve.\n\n' +
          '**🔗 [CTF Time](https://ctftime.org/)**\n' +
          'Website dedicated to listing all future CTF events.'
        );

      await interaction.reply({ 
        embeds: [top5Embed, offensiveEmbed, defensiveEmbed, ctfEmbed],
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error sending resources:', error);
      await interaction.reply({ 
        content: '❌ There was an error sending the resources!', 
        ephemeral: true 
      });
    }
  }

  private async handleSendInterests(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check if user has administrator permissions
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({ 
        content: '❌ You need Administrator permissions to use this command.', 
        ephemeral: true 
      });
      return;
    }
    const interestsEmbed = new EmbedBuilder()
      .setTitle('Roles')
      .setDescription('Select your Discord roles!')
      .setColor(0x00ff00);

    // Club Relation buttons (Blurple)
    const clubRelationRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('role_first_year')
          .setLabel('1st Year')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('1️⃣'),
        new ButtonBuilder()
          .setCustomId('role_second_year')
          .setLabel('2nd Year')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('2️⃣'),
        new ButtonBuilder()
          .setCustomId('role_third_year')
          .setLabel('3rd Year')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('3️⃣'),
        new ButtonBuilder()
          .setCustomId('role_fourth_year')
          .setLabel('4th Year')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('4️⃣'),
        new ButtonBuilder()
          .setCustomId('role_alumni_other')
          .setLabel('Alumni/Other')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐')
      );

    // Club Interests buttons (Green)
    const clubInterestsRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('role_offense')
          .setLabel('Offense (CPTC)')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⚔️'),
        new ButtonBuilder()
          .setCustomId('role_defense')
          .setLabel('Defense (CCDC)')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🛡️'),
        new ButtonBuilder()
          .setCustomId('role_ctf')
          .setLabel('CTF')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🏳️'),
        new ButtonBuilder()
          .setCustomId('role_gaming')
          .setLabel('Gaming')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎮')
      );

    const description = `**🎓 Club Relation**
Blue buttons: Select your class rank or association with the club.

**Available Roles:**
• 1️⃣ **1st Year** - First year student
• 2️⃣ **2nd Year** - Second year student  
• 3️⃣ **3rd Year** - Third year student
• 4️⃣ **4th Year** - Fourth year student
• ⭐ **Alumni/Other** - Alumni, industry professionals, etc.

**🎯 Club Interests**
Green buttons: Select roles that interest you.

**Available Roles:**
• ⚔️ **Offense (CPTC)** - For people interested in offensive security and penetration testing. This is also for people interested in our CPTC competition team!
• 🛡️ **Defense (CCDC)** - For people interested in defensive security and security monitoring. This is also for people interested in our CCDC competition team!
• 🏳️ **CTF** - For people interested in competing in CTFs such as NCL and PicoCTF. This is also for people interested in other platforms such as Hack the Box, TryHackMe, and Blue Team Labs Online!
• 🎮 **Gaming** - For people interested in hanging out with club members and playing video games. Some of the games include Minecraft, Among Us, and Escape From Tarkov!`;

    interestsEmbed.setDescription(description);

    await interaction.reply({ 
      embeds: [interestsEmbed], 
      components: [clubRelationRow, clubInterestsRow],
      ephemeral: false
    });
  }

  private async handleSetNewUsers(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check if user has administrator permissions
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({ 
        content: '❌ You need Administrator permissions to use this command.', 
        ephemeral: true 
      });
      return;
    }

    try {
      // Get the current channel ID
      const channelId = interaction.channelId;
      
      // Update the database with the new channel ID
      await this.prisma.discordConfig.upsert({
        where: { key: 'DISCORD_NEW_USERS_CHANNEL_ID' },
        update: { 
          value: channelId,
          updatedAt: new Date()
        },
        create: {
          key: 'DISCORD_NEW_USERS_CHANNEL_ID',
          value: channelId,
          description: 'New users channel ID'
        }
      });

      await interaction.reply({ 
        content: `✅ New users channel has been set to <#${channelId}>!`, 
        ephemeral: true 
      });
    } catch (error) {
      logger.error('Error setting new users channel:', error);
      await interaction.reply({ 
        content: '❌ There was an error setting the new users channel!', 
        ephemeral: true 
      });
    }
  }

  private async handleRoleButton(interaction: any): Promise<void> {
    try {
      const { customId, user } = interaction;
      const roleType = customId.replace('role_', '');

      // Get role ID from database based on role type
      const roleId = await this.getRoleIdFromDatabase(roleType);
      if (!roleId) {
        await interaction.reply({ content: 'Role not found!', ephemeral: true });
        return;
      }

      // Check if user has MRM account linked
      const hasLinkedAccount = await this.checkUserMRMLink(user.id);

      // Get user-friendly role name
      const roleName = this.getRoleDisplayName(roleType);

      // Check if this is a year/class rank role
      const isYearRole = ['first_year', 'second_year', 'third_year', 'fourth_year', 'alumni_other'].includes(roleType);

      const member = await this.guild!.members.fetch(user.id);
      const hasRole = member.roles.cache.has(roleId);

      // Discord only allows a single reply per interaction; the role-update
      // result becomes that reply and everything else uses followUp().
      let resultMessage: string;

      if (isYearRole) {
        // For year roles: always set (replace any existing year role)
        if (hasRole) {
          // User already has this year role, remove it
          await member.roles.remove(roleId);
          resultMessage = `${roleName} has been removed from your account.`;

          // Update MRM database if account is linked
          if (hasLinkedAccount) {
            await this.updateMRMUserInterest(user.id, roleType, false);
          }
        } else {
          // Remove any existing year roles first
          await this.removeAllYearRoles(member);

          // Add the new year role
          await member.roles.add(roleId);
          resultMessage = `${roleName} has been set as your class rank.`;

          // Update MRM database if account is linked
          if (hasLinkedAccount) {
            await this.updateMRMUserInterest(user.id, roleType, true);
          }
        }
      } else {
        // For interest roles: toggle behavior
        if (hasRole) {
          await member.roles.remove(roleId);
          resultMessage = `Interest ${roleName} has been removed from your account.`;
        } else {
          await member.roles.add(roleId);
          resultMessage = `Interest ${roleName} has been added to your account.`;
        }

        // Update MRM database if account is linked
        if (hasLinkedAccount) {
          await this.updateMRMUserInterest(user.id, roleType, !hasRole);
        }
      }

      await interaction.reply({ content: resultMessage, ephemeral: true });

      if (!hasLinkedAccount) {
        const verifyButton = new ButtonBuilder()
          .setLabel('Link Account')
          .setStyle(ButtonStyle.Link)
          .setURL('https://mrm.psuccso.org/join')
          .setEmoji('🚀');

        const buttonRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(verifyButton);

        await interaction.followUp({
          content: '⚠️ Warning: Your Discord account is not linked to an MRM account. Please link your accounts to access role benefits.',
          components: [buttonRow],
          ephemeral: true
        });
      }

    } catch (error) {
      logger.error('Error handling role button:', error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error processing your role selection!', ephemeral: true });
      }
    }
  }

  private async removeAllYearRoles(member: any): Promise<void> {
    try {
      const yearRoleIds = [
        await this.getRoleIdFromDatabase('first_year'),
        await this.getRoleIdFromDatabase('second_year'),
        await this.getRoleIdFromDatabase('third_year'),
        await this.getRoleIdFromDatabase('fourth_year'),
        await this.getRoleIdFromDatabase('alumni_other')
      ].filter(id => id !== null);

      for (const roleId of yearRoleIds) {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
        }
      }
    } catch (error) {
      logger.error('Error removing year roles:', error);
    }
  }

  private async handleGuildMemberAdd(member: any): Promise<void> {
    try {
      logger.info(`New member joined: ${member.user.tag} (${member.id})`);

      // Guard against duplicate guildMemberAdd dispatches (e.g. gateway
      // resume replays) sending a second welcome message for the same join.
      const now = Date.now();
      const lastWelcomed = this.recentWelcomes.get(member.id);
      if (lastWelcomed && now - lastWelcomed < 60_000) {
        logger.warn(`Ignoring duplicate guildMemberAdd dispatch for ${member.id}`);
        return;
      }
      this.recentWelcomes.set(member.id, now);
      setTimeout(() => {
        if (this.recentWelcomes.get(member.id) === now) {
          this.recentWelcomes.delete(member.id);
        }
      }, 60_000);

      // The in-memory guard above only protects one Node process. Redis makes
      // the same event idempotent when multiple containers or old/new rollout
      // instances are connected with the same bot token.
      const joinedAt = member.joinedTimestamp || member.joinedAt?.getTime() || now;
      if (!await this.claimGatewayEvent(`member-add:${member.guild.id}:${member.id}:${joinedAt}`, 86_400)) {
        return;
      }

      // Get the new users channel ID from database
      const newUsersChannelId = await this.getNewUsersChannelId();
      if (!newUsersChannelId) {
        logger.warn('No new users channel configured, skipping welcome message');
        return;
      }

      // Send welcome message
      await this.sendWelcomeMessage(member, newUsersChannelId);

    } catch (error) {
      logger.error('Error handling new guild member:', error);
    }
  }

  /**
   * Claim a Discord gateway event across every running application process.
   * Discord sends each gateway event to every session using the bot token, so
   * process-local Sets cannot prevent duplicate side effects.
   */
  private async claimGatewayEvent(eventKey: string, ttlSeconds: number): Promise<boolean> {
    try {
      if (!this.eventDedupRedis) {
        this.eventDedupRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
          maxRetriesPerRequest: 1,
          lazyConnect: true
        });
      }

      if (this.eventDedupRedis.status === 'wait') {
        await this.eventDedupRedis.connect();
      }

      const claimed = await this.eventDedupRedis.set(
        `discord:gateway-event:${eventKey}`,
        `${process.pid}`,
        'EX',
        ttlSeconds,
        'NX'
      );

      if (claimed !== 'OK') {
        logger.warn(`Ignoring Discord gateway event already claimed by another process: ${eventKey}`);
        return false;
      }

      return true;
    } catch (error) {
      // Discord should remain usable during a Redis outage. The existing
      // process-local guards still provide limited protection in that case.
      logger.error('Failed to claim Discord gateway event in Redis; using local handling:', error);
      return true;
    }
  }

  private async sendWelcomeMessage(member: any, channelId: string): Promise<void> {
    try {
      const channel = await this.guild!.channels.fetch(channelId) as TextChannel;
      if (!channel) {
        logger.error(`New users channel not found: ${channelId}`);
        return;
      }

      // Get current time in a nice format
      const now = new Date();
      const timeString = now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      // Create welcome embed
      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`Welcome ${member.displayName || member.user.username}!`)
        .setDescription(`Welcome to the PSU CCSO server! Please take a moment to read the rules and then click the button below to verify your membership!`)
        .setColor(0x2563eb) // Blue
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 128 }))
        .setTimestamp(now);

      // Create button to link to MRM
      const verifyButton = new ButtonBuilder()
        .setLabel('Get Started')
        .setStyle(ButtonStyle.Link)
        .setURL('https://mrm.psuccso.org/join')
        .setEmoji('🚀');

      const buttonRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(verifyButton);

      // enforceNonce makes this send idempotent: if @discordjs/rest aborts a
      // slow POST and retries it, Discord rejects the retry instead of posting
      // a duplicate welcome. The nonce is fixed for this call, so it is shared
      // across the internal retries of the single send() below.
      await channel.send({
        nonce: SnowflakeUtil.generate().toString(),
        enforceNonce: true,
        content: `${member}`,
        embeds: [welcomeEmbed],
        components: [buttonRow]
      });

      logger.info(`Welcome message sent for user: ${member.user.tag}`);
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  }

  private getRoleDisplayName(roleType: string): string {
    const roleNameMap: { [key: string]: string } = {
      'first_year': '1st Year',
      'second_year': '2nd Year',
      'third_year': '3rd Year',
      'fourth_year': '4th Year',
      'alumni_other': 'Alumni/Other',
      'offense': 'Offense',
      'defense': 'Defense',
      'ctf': 'CTF',
      'gaming': 'Gaming'
    };
    
    return roleNameMap[roleType] || roleType;
  }

  private async getRoleIdFromDatabase(roleType: string): Promise<string | null> {
    try {
      const roleMapping: { [key: string]: string } = {
        'first_year': 'DISCORD_FIRST_YEAR_ROLE_ID',
        'second_year': 'DISCORD_SECOND_YEAR_ROLE_ID',
        'third_year': 'DISCORD_THIRD_YEAR_ROLE_ID',
        'fourth_year': 'DISCORD_FOURTH_YEAR_ROLE_ID',
        'alumni_other': 'DISCORD_ALUMNI_OTHER_ROLE_ID',
        'offense': 'DISCORD_OFFENSE_ROLE_ID',
        'defense': 'DISCORD_DEFENSE_ROLE_ID',
        'ctf': 'DISCORD_CTF_ROLE_ID',
        'gaming': 'DISCORD_GAMING_ROLE_ID'
      };

      const configKey = roleMapping[roleType];
      if (!configKey) return null;

      // Get role ID from database
      const config = await this.prisma.discordConfig.findUnique({
        where: { key: configKey }
      });

      if (!config) {
        logger.warn(`Discord config not found for key: ${configKey}`);
        return null;
      }

      return config.value;
    } catch (error) {
      logger.error(`Error getting role ID from database for role type: ${roleType}`, error);
      return null;
    }
  }

  private async checkUserMRMLink(discordId: string): Promise<boolean> {
    try {
      const discordAccount = await this.prisma.discordAccount.findUnique({
        where: { discordId }
      });
      return !!discordAccount;
    } catch (error) {
      logger.error(`Error checking MRM account link for Discord ID: ${discordId}`, error);
      return false;
    }
  }

  private async updateMRMUserInterest(discordId: string, roleType: string, isAdding: boolean): Promise<void> {
    try {
      const discordAccount = await this.prisma.discordAccount.findUnique({
        where: { discordId },
        include: { user: true }
      });

      if (!discordAccount) {
        logger.warn(`No MRM account found for Discord ID: ${discordId}`);
        return;
      }

      // Map Discord role types to MRM types
      const interestMapping: { [key: string]: string } = {
        'offense': 'OFFENSE',
        'defense': 'DEFENSE',
        'ctf': 'CTF',
        'gaming': 'GAMING'
      };

      const roleMapping: { [key: string]: string } = {
        'first_year': 'FIRST_YEAR',
        'second_year': 'SECOND_YEAR',
        'third_year': 'THIRD_YEAR',
        'fourth_year': 'FOURTH_YEAR',
        'alumni_other': 'ALUMNI_OTHER'
      };

      // Handle interest types
      const mrmInterest = interestMapping[roleType];
      if (mrmInterest) {
        if (isAdding) {
          // Add interest
          await this.prisma.userInterest.upsert({
            where: {
              userId_interest: {
                userId: discordAccount.userId,
                interest: mrmInterest as any
              }
            },
            update: {},
            create: {
              userId: discordAccount.userId,
              interest: mrmInterest as any
            }
          });
          logger.info(`Added MRM interest for user ${discordAccount.userId}: ${mrmInterest}`);
        } else {
          // Remove interest
          await this.prisma.userInterest.deleteMany({
            where: {
              userId: discordAccount.userId,
              interest: mrmInterest as any
            }
          });
          logger.info(`Removed MRM interest for user ${discordAccount.userId}: ${mrmInterest}`);
        }
        return;
      }

      // Handle role types (class rank)
      // Store class rank in the new UserClassRank table
      const mrmRole = roleMapping[roleType];
      if (mrmRole) {
        if (isAdding) {
          // Store class rank in UserClassRank table
          await this.prisma.userClassRank.upsert({
            where: { userId: discordAccount.userId },
            update: { classRank: mrmRole as any },
            create: {
              userId: discordAccount.userId,
              classRank: mrmRole as any
            }
          });
          logger.info(`Updated MRM class rank for user ${discordAccount.userId}: ${mrmRole}`);
        } else {
          // Remove class rank from UserClassRank table
          await this.prisma.userClassRank.deleteMany({
            where: { userId: discordAccount.userId }
          });
          logger.info(`Removed MRM class rank for user ${discordAccount.userId}: ${mrmRole}`);
        }
        return;
      }

      logger.warn(`No MRM mapping found for Discord role: ${roleType}`);
    } catch (error) {
      logger.error(`Error updating MRM user data for Discord ID: ${discordId}`, error);
    }
  }

  async getNewUsersChannelId(): Promise<string | null> {
    try {
      const config = await this.prisma.discordConfig.findUnique({
        where: { key: 'DISCORD_NEW_USERS_CHANNEL_ID' }
      });
      return config?.value || null;
    } catch (error) {
      logger.error('Error getting new users channel ID from database:', error);
      return null;
    }
  }

  async lookupRoleByName(roleName: string): Promise<string | null> {
    try {
      // Try to find the role by name in the guild
      const roles = await this.guild!.roles.fetch();
      const role = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
      
      if (role) {
        logger.info(`Found role '${roleName}' with ID: ${role.id}`);
        return role.id;
      }

      logger.warn(`Role '${roleName}' not found in guild`);
      return null;
    } catch (error) {
      logger.error(`Error looking up role by name: ${roleName}`, error);
      return null;
    }
  }

  async updateRoleIdInDatabase(roleKey: string, roleId: string): Promise<void> {
    try {
      await this.prisma.discordConfig.upsert({
        where: { key: roleKey },
        update: { 
          value: roleId,
          updatedAt: new Date()
        },
        create: {
          key: roleKey,
          value: roleId,
          description: `Role ID for ${roleKey}`
        }
      });
      logger.info(`Updated role ID in database: ${roleKey} = ${roleId}`);
    } catch (error) {
      logger.error(`Error updating role ID in database: ${roleKey}`, error);
    }
  }

  // Get guild method for health checks
  async getGuild(): Promise<Guild | null> {
    return this.guild;
  }
}
