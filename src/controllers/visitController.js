const Visit = require('../models/Visit');
const User = require('../models/User');

class VisitController {
  /**
   * Create a new preventive maintenance visit
   */
  static async createVisit(req, res, next) {
    try {
      const { userId, engineerId, visitDate, notes } = req.body;
      const createdBy = req.user.id;

      // Validate user exists and is an AMC user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check if user is AMC type
      const siteType = (user.site_type || '').toLowerCase();
      if (!siteType.includes('amc')) {
        return res.status(400).json({
          success: false,
          message: 'Preventive visits are only for AMC users',
        });
      }

      // Validate engineer exists if provided
      if (engineerId) {
        const engineer = await User.findById(engineerId);
        if (!engineer || engineer.role !== 'engineer') {
          return res.status(400).json({
            success: false,
            message: 'Invalid engineer assigned',
          });
        }
      }

      // Validate visit date is in the future
      const visitDateObj = new Date(visitDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (visitDateObj < today) {
        return res.status(400).json({
          success: false,
          message: 'Visit date must be today or in the future',
        });
      }

      const newVisit = await Visit.create({
        user_id: userId,
        engineer_id: engineerId,
        visit_date: visitDate,
        notes,
        created_by: createdBy,
      });

      // Fetch the complete visit with details
      const visitWithDetails = await Visit.findById(newVisit.id);

      res.status(201).json({
        success: true,
        message: 'Visit scheduled successfully',
        data: visitWithDetails,
      });
    } catch (error) {
      console.error('[Visit] Create error:', error.message);
      console.error('[Visit] Error stack:', error.stack);
      next(error);
    }
  }

  /**
   * Get all visits (with filters)
   */
  static async getVisits(req, res, next) {
    try {
      const { userId, engineerId, status, startDate, endDate, amcOnly } = req.query;

      const filters = {};
      if (userId) filters.userId = userId;
      if (engineerId) filters.engineerId = engineerId;
      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (amcOnly === 'true') filters.amcOnly = true;

      const visits = await Visit.getAll(filters);

      res.status(200).json({
        success: true,
        data: visits,
        count: visits.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get visits for current engineer
   */
  static async getMyVisits(req, res, next) {
    try {
      const engineerId = req.user.id;
      const { upcoming, days } = req.query;

      let visits;
      if (upcoming === 'true') {
        visits = await Visit.getUpcomingVisits(engineerId, parseInt(days) || 30);
      } else {
        visits = await Visit.getAll({ engineerId });
      }

      res.status(200).json({
        success: true,
        data: visits,
        count: visits.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single visit by ID
   */
  static async getVisitById(req, res, next) {
    try {
      const { id } = req.params;
      const visit = await Visit.findById(id);

      if (!visit) {
        return res.status(404).json({
          success: false,
          message: 'Visit not found',
        });
      }

      res.status(200).json({
        success: true,
        data: visit,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a visit
   */
  static async updateVisit(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const visit = await Visit.findById(id);
      if (!visit) {
        return res.status(404).json({
          success: false,
          message: 'Visit not found',
        });
      }

      // Prevent updating completed visits
      if (visit.status === 'completed' && updates.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify a completed visit',
        });
      }

      const updatedVisit = await Visit.update(id, updates);

      res.status(200).json({
        success: true,
        message: 'Visit updated successfully',
        data: updatedVisit,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete a visit (engineer action)
   */
  static async completeVisit(req, res, next) {
    try {
      const { id } = req.params;
      const { completionNotes } = req.body;
      const engineerId = req.user.id;

      const visit = await Visit.findById(id);
      if (!visit) {
        return res.status(404).json({
          success: false,
          message: 'Visit not found',
        });
      }

      // Only assigned engineer or admin can complete
      if (visit.engineer_id !== engineerId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only assigned engineer can complete this visit',
        });
      }

      const updatedVisit = await Visit.update(id, {
        status: 'completed',
        completion_notes: completionNotes,
      });

      res.status(200).json({
        success: true,
        message: 'Visit marked as completed',
        data: updatedVisit,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a visit
   */
  static async deleteVisit(req, res, next) {
    try {
      const { id } = req.params;

      const visit = await Visit.findById(id);
      if (!visit) {
        return res.status(404).json({
          success: false,
          message: 'Visit not found',
        });
      }

      // Prevent deleting completed visits
      if (visit.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete a completed visit',
        });
      }

      await Visit.delete(id);

      res.status(200).json({
        success: true,
        message: 'Visit deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get overdue visits
   */
  static async getOverdueVisits(req, res, next) {
    try {
      const visits = await Visit.getOverdueVisits();

      res.status(200).json({
        success: true,
        data: visits,
        count: visits.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get visit statistics for a user
   */
  static async getUserVisitStats(req, res, next) {
    try {
      const { userId } = req.params;

      const stats = await Visit.getUserVisitStats(userId);
      const visitCheck = await Visit.checkVisitNeeded(userId);

      res.status(200).json({
        success: true,
        data: {
          ...stats,
          needsVisit: visitCheck.needsVisit,
          lastVisitDate: visitCheck.lastVisitDate,
          reason: visitCheck.reason,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if user needs a visit and auto-schedule suggestion
   */
  static async checkVisitNeeded(req, res, next) {
    try {
      const { userId } = req.params;

      const result = await Visit.checkVisitNeeded(userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = VisitController;
