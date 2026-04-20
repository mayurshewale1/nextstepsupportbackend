const XLSX = require('xlsx');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

class ReportController {
  /**
   * Generate Engineer Performance Report
   * Shows tickets solved by each engineer with ratings
   */
  static async generateEngineerReport(req, res, next) {
    try {
      const { startDate, endDate, period } = req.query;
      
      // Get all resolved/closed tickets
      const tickets = await Ticket.findAll({
        startDate,
        endDate,
        period,
        status: null, // Get all statuses
      });

      // Get all engineers
      const engineers = await User.getAll({ role: 'engineer' });
      
      // Calculate statistics per engineer
      const engineerStats = engineers.map(engineer => {
        const engineerTickets = tickets.filter(t => t.assigned_to === engineer.id);
        const resolvedTickets = engineerTickets.filter(t => 
          t.status === 'resolved' || t.status === 'closed' || t.status === 'completed'
        );
        const ratedTickets = resolvedTickets.filter(t => t.rating != null);
        
        const avgRating = ratedTickets.length > 0
          ? ratedTickets.reduce((sum, t) => sum + t.rating, 0) / ratedTickets.length
          : 0;

        return {
          engineerId: engineer.user_id,
          engineerName: engineer.name,
          engineerEmail: engineer.email,
          engineerPhone: engineer.phone || '',
          totalAssigned: engineerTickets.length,
          resolved: resolvedTickets.length,
          inProgress: engineerTickets.filter(t => t.status === 'in-progress').length,
          open: engineerTickets.filter(t => t.status === 'open').length,
          ratedTickets: ratedTickets.length,
          averageRating: avgRating.toFixed(2),
        };
      });

      // Sort by resolved tickets (descending)
      engineerStats.sort((a, b) => b.resolved - a.resolved);

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Engineer Summary Sheet
      const wsStats = XLSX.utils.json_to_sheet(engineerStats);
      XLSX.utils.book_append_sheet(wb, wsStats, 'Engineer Summary');

      // Detailed Tickets Sheet
      const detailedTickets = tickets
        .filter(t => t.assigned_to)
        .map(t => ({
          ticketId: `NXP-SVC-${String(t.id).padStart(6, '0')}`,
          title: t.title,
          category: t.category || '',
          status: t.status,
          priority: t.priority,
          engineerName: t.assigned_to_name || '',
          engineerEmail: t.assigned_to_email || '',
          customerName: t.created_by_name || '',
          customerEmail: t.created_by_email || '',
          createdAt: t.created_at ? new Date(t.created_at).toLocaleString() : '',
          resolvedAt: t.resolved_at ? new Date(t.resolved_at).toLocaleString() : '',
          rating: t.rating || '',
          feedback: t.feedback_comment || '',
          resolution: t.resolution || '',
        }));
      
      const wsDetails = XLSX.utils.json_to_sheet(detailedTickets);
      XLSX.utils.book_append_sheet(wb, wsDetails, 'Ticket Details');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // Set headers for download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=engineer-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate Comprehensive Ticket Report with User Feedback
   */
  static async generateTicketReport(req, res, next) {
    try {
      const { startDate, endDate, period, status } = req.query;
      
      const tickets = await Ticket.findAll({
        startDate,
        endDate,
        period,
        status: status || null,
      });

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Main Ticket Report
      const ticketData = tickets.map(t => ({
        ticketId: `NXP-SVC-${String(t.id).padStart(6, '0')}`,
        title: t.title,
        description: t.description,
        category: t.category || '',
        status: t.status,
        priority: t.priority,
        systemType: t.system_type || '',
        customerName: t.created_by_name || '',
        customerEmail: t.created_by_email || '',
        customerUserId: t.created_by_user_id || '',
        engineerName: t.assigned_to_name || '',
        engineerEmail: t.assigned_to_email || '',
        createdAt: t.created_at ? new Date(t.created_at).toLocaleString() : '',
        updatedAt: t.updated_at ? new Date(t.updated_at).toLocaleString() : '',
        resolvedAt: t.resolved_at ? new Date(t.resolved_at).toLocaleString() : '',
        rating: t.rating || '',
        feedback: t.feedback_comment || '',
        resolution: t.resolution || '',
      }));
      
      const wsTickets = XLSX.utils.json_to_sheet(ticketData);
      XLSX.utils.book_append_sheet(wb, wsTickets, 'All Tickets');

      // Feedback Summary Sheet
      const feedbackTickets = tickets.filter(t => t.rating != null);
      const feedbackData = feedbackTickets.map(t => ({
        ticketId: `NXP-SVC-${String(t.id).padStart(6, '0')}`,
        customerName: t.created_by_name || '',
        engineerName: t.assigned_to_name || '',
        rating: t.rating,
        feedback: t.feedback_comment || '',
        resolution: t.resolution || '',
        createdAt: t.created_at ? new Date(t.created_at).toLocaleString() : '',
        resolvedAt: t.resolved_at ? new Date(t.resolved_at).toLocaleString() : '',
      }));
      
      // Add rating summary
      const ratingStats = {
        totalRated: feedbackTickets.length,
        averageRating: feedbackTickets.length > 0
          ? (feedbackTickets.reduce((sum, t) => sum + t.rating, 0) / feedbackTickets.length).toFixed(2)
          : 0,
        fiveStar: feedbackTickets.filter(t => t.rating === 5).length,
        fourStar: feedbackTickets.filter(t => t.rating === 4).length,
        threeStar: feedbackTickets.filter(t => t.rating === 3).length,
        twoStar: feedbackTickets.filter(t => t.rating === 2).length,
        oneStar: feedbackTickets.filter(t => t.rating === 1).length,
      };
      
      const wsFeedback = XLSX.utils.json_to_sheet(feedbackData);
      XLSX.utils.book_append_sheet(wb, wsFeedback, 'User Feedback');
      
      // Add rating summary as a separate sheet
      const wsRatingStats = XLSX.utils.json_to_sheet([ratingStats]);
      XLSX.utils.book_append_sheet(wb, wsRatingStats, 'Rating Summary');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // Set headers for download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=ticket-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get report statistics (for dashboard display)
   */
  static async getReportStats(req, res, next) {
    try {
      const { startDate, endDate, period } = req.query;
      
      const tickets = await Ticket.findAll({
        startDate,
        endDate,
        period,
        status: null,
      });

      const engineers = await User.getAll({ role: 'engineer' });
      
      // Calculate overall stats
      const resolvedTickets = tickets.filter(t => 
        t.status === 'resolved' || t.status === 'closed' || t.status === 'completed'
      );
      const ratedTickets = resolvedTickets.filter(t => t.rating != null);
      
      const avgRating = ratedTickets.length > 0
        ? ratedTickets.reduce((sum, t) => sum + t.rating, 0) / ratedTickets.length
        : 0;

      // Engineer leaderboard
      const engineerStats = engineers.map(engineer => {
        const engineerTickets = tickets.filter(t => t.assigned_to === engineer.id);
        const resolved = engineerTickets.filter(t => 
          t.status === 'resolved' || t.status === 'closed' || t.status === 'completed'
        );
        const rated = resolved.filter(t => t.rating != null);
        
        return {
          engineerId: engineer.user_id,
          engineerName: engineer.name,
          totalTickets: engineerTickets.length,
          resolvedTickets: resolved.length,
          averageRating: rated.length > 0
            ? (rated.reduce((sum, t) => sum + t.rating, 0) / rated.length).toFixed(2)
            : 0,
        };
      }).sort((a, b) => b.resolvedTickets - a.resolvedTickets);

      res.json({
        success: true,
        data: {
          totalTickets: tickets.length,
          resolvedTickets: resolvedTickets.length,
          inProgress: tickets.filter(t => t.status === 'in-progress').length,
          open: tickets.filter(t => t.status === 'open').length,
          averageRating: avgRating.toFixed(2),
          totalRated: ratedTickets.length,
          engineerLeaderboard: engineerStats.slice(0, 5), // Top 5
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReportController;
