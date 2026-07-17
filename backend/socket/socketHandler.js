const jwt = require('jsonwebtoken');
const { registerSocket, removeSocket } = require('../services/notificationService');

const initializeSocket = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.userDepartment = decoded.department;
      next();
    } catch (error) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.userId}`);
    registerSocket(socket.userId, socket.id);

    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.userRole}`);
    socket.join(`dept:${socket.userDepartment}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.userId}`);
      removeSocket(socket.userId);
    });
  });
};

module.exports = { initializeSocket };
