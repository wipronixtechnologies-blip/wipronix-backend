const { Server } = require('socket.io');

let io = null;

// Initialize Socket.IO server
const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Join a room based on user role (for targeted broadcasts)
    socket.on('joinRoleRoom', (role) => {
      if (role) {
        socket.join(`role:${role.toLowerCase()}`);
        console.log(`Socket ${socket.id} joined role room: ${role.toLowerCase()}`);
      }
    });

    // Join a user-specific room
    socket.on('joinUserRoom', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined user room: user:${userId}`);
      }
    });

    // Join a conversation room
    socket.on('joinConversation', (conversationId) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
        console.log(`Socket ${socket.id} joined conversation: ${conversationId}`);
      }
    });

    // Leave a conversation room
    socket.on('leaveConversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        console.log(`Socket ${socket.id} left conversation: ${conversationId}`);
      }
    });

    // Join the general broadcast room
    socket.join('broadcasts');
  });

  return io;
};

// Get the Socket.IO instance
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Emit a new message to the recipient's personal room
const emitNewMessage = (recipientId, message) => {
  if (io) {
    // Notify the recipient directly (e.g., for push notification or unread badge update)
    io.to(`user:${recipientId}`).emit('newMessage', message);
    
    // Also emit to the conversation room if the recipient is currently viewing it
    io.to(`conversation:${message.conversationId}`).emit('newMessage', message);
    
    console.log(`Message emitted to user:${recipientId} and conversation:${message.conversationId}`);
  }
};

// Emit message read event
const emitMessageRead = (conversationId, userId) => {
  if (io) {
    // Notify all participants in the conversation room that messages were read by userId
    io.to(`conversation:${conversationId}`).emit('messageRead', { conversationId, readBy: userId });
    console.log(`Message read event emitted for conversation:${conversationId} by ${userId}`);
  }
};

// Emit typing status
const emitTyping = (conversationId, userId, isTyping) => {
    if (io) {
        io.to(`conversation:${conversationId}`).emit('typing', { conversationId, userId, isTyping });
    }
}

// Emit a new broadcast event to all connected clients
const emitNewBroadcast = (broadcast) => {
  if (io) {
    // Emit to all connected clients in the broadcasts room
    io.to('broadcasts').emit('newBroadcast', broadcast);
    
    // Also emit to specific role rooms based on target audience
    if (broadcast.targetAudience && broadcast.targetAudience !== 'all') {
      io.to(`role:${broadcast.targetAudience}`).emit('newBroadcast', broadcast);
    }
    
    console.log(`Broadcast ${broadcast.id} emitted to all clients`);
  }
};

// Emit broadcast update event
const emitBroadcastUpdate = (broadcast) => {
  if (io) {
    io.to('broadcasts').emit('broadcastUpdated', broadcast);
    console.log(`Broadcast ${broadcast.id} update emitted`);
  }
};

// Emit broadcast delete event
const emitBroadcastDelete = (broadcastId) => {
  if (io) {
    io.to('broadcasts').emit('broadcastDeleted', broadcastId);
    console.log(`Broadcast ${broadcastId} delete emitted`);
  }
};

// Export all socket methods
const emitTaskAssigned = (userId, task) => {
  if (io) {
    io.to(`user:${userId}`).emit('taskAssigned', task);
    console.log(`Task assigned event emitted to user:${userId}`);
  }
};

const emitTaskUpdated = (userId, task) => {
  if (io) {
    io.to(`user:${userId}`).emit('taskUpdated', task);
    console.log(`Task updated event emitted to user:${userId}`);
  }
};

const emitTaskStatusUpdated = (userId, task) => {
    // Notify the user who assigned it (manager)
     if (io) {
        io.to(`user:${userId}`).emit('taskStatusUpdated', task);
        console.log(`Task status update event emitted to user:${userId}`);
    }
};

const emitTaskDeleted = (userId, taskId) => {
    if (io) {
        io.to(`user:${userId}`).emit('taskDeleted', taskId);
        console.log(`Task deleted event emitted to user:${userId}`);
    }
};

const emitNotification = (userId, notification) => {
    if (io) {
        io.to(`user:${userId}`).emit('newNotification', notification);
        console.log(`Notification emitted to user:${userId}`);
    }
};

module.exports = {
  initSocketServer,
  getIO,
  emitNewMessage,
  emitMessageRead,  
  emitTyping, 
  emitNewBroadcast,
  emitBroadcastUpdate,
  emitBroadcastDelete,
  emitTaskAssigned,
  emitTaskUpdated,
  emitTaskStatusUpdated,
  emitTaskDeleted,
  emitNotification
};
