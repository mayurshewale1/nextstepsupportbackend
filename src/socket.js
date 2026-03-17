/**
 * Socket.IO server for real-time ticket updates
 * Emits events when tickets are created or assigned
 */
let io = null;

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) || '*',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join-engineer', (engineerId) => {
      if (engineerId) socket.join(`engineer:${engineerId}`);
    });
    socket.on('join-admin', () => socket.join('admin'));
    socket.on('join-user', (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitTicketCreated(ticket) {
  if (io) {
    io.to('admin').emit('ticket:created', ticket);
    if (ticket.assigned_to) {
      io.to(`engineer:${ticket.assigned_to}`).emit('ticket:assigned', ticket);
    }
  }
}

function emitTicketAssigned(ticket) {
  if (io && ticket.assigned_to) {
    io.to(`engineer:${ticket.assigned_to}`).emit('ticket:assigned', ticket);
    io.to('admin').emit('ticket:updated', ticket);
  }
}

function emitTicketUpdated(ticket) {
  if (io) {
    io.to('admin').emit('ticket:updated', ticket);
    if (ticket.assigned_to) {
      io.to(`engineer:${ticket.assigned_to}`).emit('ticket:updated', ticket);
    }
    if (ticket.created_by) {
      io.to(`user:${ticket.created_by}`).emit('ticket:updated', ticket);
      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        io.to(`user:${ticket.created_by}`).emit('ticket:completed', ticket);
      }
    }
  }
}

module.exports = { initSocket, getIO, emitTicketCreated, emitTicketAssigned, emitTicketUpdated };
