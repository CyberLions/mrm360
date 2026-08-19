import { PrismaClient, PaymentType, PaymentStatus } from '@prisma/client';
import { logger } from '@/utils/logger';
import { MemberPaidStatusService } from './memberPaidStatusService';
import { inferSemester, isValidSemester } from '@/utils/semester';

export interface CreatePaymentData {
  userId: string;
  amount: number;
  paymentType: PaymentType;
  paymentMethod?: string;
  transactionId?: string;
  semester?: string;
}

export interface PaymentExpirationResult {
  userId: string;
  email: string;
  expiredPayments: number;
  newPaidStatus: boolean;
}

export class PaymentService {
  private prisma: PrismaClient;
  private memberPaidStatusService: MemberPaidStatusService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.memberPaidStatusService = new MemberPaidStatusService(prisma);
  }

  /**
   * Create a new payment record
   */
  async createPayment(data: CreatePaymentData): Promise<any> {
    try {
      logger.info('Creating payment', { userId: data.userId, paymentType: data.paymentType });

      // Calculate expiration date based on payment type
      const assignment = data.semester
        ? this.getSemesterAssignment(data.semester)
        : inferSemester();
      const expiresAt = this.calculateExpirationDate(data.paymentType, assignment.semester);

      const payment = await this.prisma.payment.create({
        data: {
          userId: data.userId,
          amount: data.amount,
          paymentType: data.paymentType,
          semester: assignment.semester,
          paymentMethod: data.paymentMethod,
          transactionId: data.transactionId,
          expiresAt,
          status: PaymentStatus.PENDING
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      logger.info('Payment created successfully', { paymentId: payment.id });
      return payment;
    } catch (error) {
      logger.error('Failed to create payment', { error, data });
      throw error;
    }
  }

  /**
   * Mark a payment as completed
   */
  async completePayment(paymentId: string, transactionId?: string): Promise<any> {
    try {
      logger.info('Completing payment', { paymentId });

      const payment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
          ...(transactionId && { transactionId })
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Update user's paid status
      await this.updateUserPaidStatus(payment.userId);

      logger.info('Payment completed successfully', { paymentId });
      return payment;
    } catch (error) {
      logger.error('Failed to complete payment', { error, paymentId });
      throw error;
    }
  }

  /**
   * Mark a payment as failed
   */
  async failPayment(paymentId: string, reason?: string): Promise<any> {
    try {
      logger.info('Failing payment', { paymentId, reason });

      const payment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.FAILED
        }
      });

      logger.info('Payment marked as failed', { paymentId });
      return payment;
    } catch (error) {
      logger.error('Failed to mark payment as failed', { error, paymentId });
      throw error;
    }
  }

  /**
   * Get user's current payment status and active payments
   */
  async getUserPaymentStatus(userId: string): Promise<{
    isPaid: boolean;
    payments: any[];
    activePayments: any[];
    expiredPayments: any[];
    nextExpiration?: Date;
  }> {
    try {
      const now = new Date();
      
      // Get all payments for the user
      const payments = await this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      // Separate active and expired payments
      const activePayments = payments.filter(p => 
        p.status === PaymentStatus.COMPLETED && p.expiresAt > now
      );
      
      const expiredPayments = payments.filter(p => 
        p.status === PaymentStatus.COMPLETED && p.expiresAt <= now
      );

      // Determine if user is currently paid
      const isPaid = activePayments.length > 0;

      // Find next expiration date
      const nextExpiration = activePayments.length > 0 
        ? new Date(Math.min(...activePayments.map(p => p.expiresAt.getTime())))
        : undefined;

      return {
        isPaid,
        payments,
        activePayments,
        expiredPayments,
        nextExpiration
      };
    } catch (error) {
      logger.error('Failed to get user payment status', { error, userId });
      throw error;
    }
  }

  /**
   * Check for expired payments and update user statuses
   */
  async checkExpiredPayments(): Promise<PaymentExpirationResult[]> {
    try {
      logger.info('Checking for expired payments');

      const now = new Date();
      
      // Find all users with expired payments
      const expiredPayments = await this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.COMPLETED,
          expiresAt: { lte: now }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              paidStatus: true
            }
          }
        }
      });

      const results: PaymentExpirationResult[] = [];
      const processedUsers = new Set<string>();

      for (const payment of expiredPayments) {
        if (processedUsers.has(payment.userId)) {
          continue; // Skip if we already processed this user
        }

        processedUsers.add(payment.userId);

        // Get user's current payment status
        const paymentStatus = await this.getUserPaymentStatus(payment.userId);
        
        // Update user's paid status if it has changed
        if (payment.user.paidStatus !== paymentStatus.isPaid) {
          await this.memberPaidStatusService.updateMemberPaidStatus(
            payment.userId, 
            paymentStatus.isPaid
          );
        }

        results.push({
          userId: payment.userId,
          email: payment.user.email,
          expiredPayments: paymentStatus.expiredPayments.length,
          newPaidStatus: paymentStatus.isPaid
        });
      }

      logger.info('Expired payments check completed', { 
        totalExpired: expiredPayments.length,
        usersProcessed: results.length 
      });

      return results;
    } catch (error) {
      logger.error('Failed to check expired payments', { error });
      throw error;
    }
  }

  /**
   * Update user's paid status based on their active payments
   */
  async updateUserPaidStatus(userId: string): Promise<void> {
    try {
      const paymentStatus = await this.getUserPaymentStatus(userId);
      
      await this.memberPaidStatusService.updateMemberPaidStatus(
        userId, 
        paymentStatus.isPaid
      );
    } catch (error) {
      logger.error('Failed to update user paid status', { error, userId });
      throw error;
    }
  }

  /**
   * Calculate expiration date based on payment type
   */
  private calculateExpirationDate(paymentType: PaymentType, semester: string): Date {
    const assignment = this.getSemesterAssignment(semester);
    switch (paymentType) {
      case PaymentType.SEMESTER:
        return assignment.endsAt;
      
      case PaymentType.YEARLY:
        return assignment.season === 'FALL'
          ? new Date(Date.UTC(assignment.year + 1, 7, 1))
          : new Date(Date.UTC(assignment.year + 1, 0, 1));
      
      default:
        throw new Error(`Unknown payment type: ${paymentType}`);
    }
  }

  private getSemesterAssignment(semester: string) {
    if (!isValidSemester(semester)) {
      throw new Error('Semester must use SPRING_YYYY or FALL_YYYY');
    }
    const [season, rawYear] = semester.split('_') as ['SPRING' | 'FALL', string];
    const year = Number(rawYear);
    return season === 'FALL'
      ? { semester, season, year, startsAt: new Date(Date.UTC(year, 7, 1)), endsAt: new Date(Date.UTC(year + 1, 0, 1)) }
      : { semester, season, year, startsAt: new Date(Date.UTC(year, 0, 1)), endsAt: new Date(Date.UTC(year, 5, 1)) };
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{
    totalPayments: number;
    activePayments: number;
    expiredPayments: number;
    totalRevenue: number;
    paymentsByType: Record<PaymentType, number>;
  }> {
    try {
      const now = new Date();
      
      const [
        totalPayments,
        activePayments,
        expiredPayments,
        paymentsByType,
        totalRevenue
      ] = await Promise.all([
        this.prisma.payment.count(),
        this.prisma.payment.count({
          where: {
            status: PaymentStatus.COMPLETED,
            expiresAt: { gt: now }
          }
        }),
        this.prisma.payment.count({
          where: {
            status: PaymentStatus.COMPLETED,
            expiresAt: { lte: now }
          }
        }),
        this.prisma.payment.groupBy({
          by: ['paymentType'],
          _count: { paymentType: true },
          where: { status: PaymentStatus.COMPLETED }
        }),
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: PaymentStatus.COMPLETED }
        })
      ]);

      const paymentsByTypeMap = paymentsByType.reduce((acc, item) => {
        acc[item.paymentType] = item._count.paymentType;
        return acc;
      }, {} as Record<PaymentType, number>);

      return {
        totalPayments,
        activePayments,
        expiredPayments,
        totalRevenue: totalRevenue._sum.amount || 0,
        paymentsByType: paymentsByTypeMap
      };
    } catch (error) {
      logger.error('Failed to get payment stats', { error });
      throw error;
    }
  }
}
