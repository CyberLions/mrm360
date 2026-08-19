import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/authMiddleware';
import { PaymentService } from '@/services/paymentService';
import { prisma } from '@/models/prismaClient';
import { logger } from '@/utils/logger';
import { withCORS } from '@/middleware/corsMiddleware';
import { PaymentType } from '@prisma/client';
import { isValidSemester } from '@/utils/semester';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const paymentService = new PaymentService(prisma);

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetPayments(req, res, paymentService);
      case 'POST':
        return await handleCreatePayment(req, res, paymentService);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('Payment API error', { error, method: req.method });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGetPayments(req: NextApiRequest, res: NextApiResponse, paymentService: PaymentService) {
  const { userId, status, paymentType, semester } = req.query;

  try {
    let payments;
    
    if (userId) {
      // Get payments for a specific user
      const paymentStatus = await paymentService.getUserPaymentStatus(userId as string);
      return res.status(200).json({
        userId,
        ...paymentStatus
      });
    } else {
      // Get all payments with optional filters
      const where: any = {};
      
      if (status) {
        where.status = status;
      }
      
      if (paymentType) {
        where.paymentType = paymentType;
      }
      if (semester) where.semester = semester;

      payments = await prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json({ payments });
    }
  } catch (error) {
    logger.error('Failed to get payments', { error });
    return res.status(500).json({ error: 'Failed to retrieve payments' });
  }
}

async function handleCreatePayment(req: NextApiRequest, res: NextApiResponse, paymentService: PaymentService) {
  const { userId, amount, paymentType, paymentMethod, transactionId, semester } = req.body;

  // Validate required fields
  if (!userId || !amount || !paymentType) {
    return res.status(400).json({ 
      error: 'Missing required fields: userId, amount, paymentType' 
    });
  }

  // Validate payment type
  if (!Object.values(PaymentType).includes(paymentType)) {
    return res.status(400).json({ 
      error: 'Invalid payment type. Must be SEMESTER or YEARLY' 
    });
  }
  if (semester && (typeof semester !== 'string' || !isValidSemester(semester))) {
    return res.status(400).json({ error: 'Semester must use SPRING_YYYY or FALL_YYYY' });
  }

  // Validate amount
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ 
      error: 'Amount must be a positive number' 
    });
  }

  try {
    const payment = await paymentService.createPayment({
      userId,
      amount,
      paymentType,
      paymentMethod,
      transactionId,
      semester
    });

    logger.info('Payment created', { 
      paymentId: payment.id, 
      userId, 
      paymentType, 
      amount 
    });

    return res.status(201).json({ payment });
  } catch (error) {
    logger.error('Failed to create payment', { error, userId, amount, paymentType });
    return res.status(500).json({ error: 'Failed to create payment' });
  }
}

export default withCORS(withAuth(handler));
