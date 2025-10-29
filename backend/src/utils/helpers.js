const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');

/**
 * Generates a cryptographically secure 6-digit numeric room code
 * @returns {string} A 6-digit room code
 */
function generateRoomCode() {
  // Generate a cryptographically secure 6-digit numeric code
  // Use crypto.randomInt for security instead of Math.random()
  const randomNum = crypto.randomInt(100000, 1000000);
  return randomNum.toString();
}

/**
 * Gets player information from a socket ID
 * @param {string} socketId - The socket.io socket ID
 * @param {Map} playerSockets - Map of socket IDs to player info
 * @returns {Object|undefined} Player information or undefined
 */
function getPlayerFromSocket(socketId, playerSockets) {
  return playerSockets.get(socketId);
}

/**
 * Sanitizes player name to prevent XSS attacks
 * Removes all HTML tags and limits length
 * @param {string} name - The player name to sanitize
 * @returns {string} Sanitized player name
 */
function sanitizePlayerName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Remove all HTML tags, only allow plain text
  const sanitized = sanitizeHtml(name, {
    allowedTags: [],
    allowedAttributes: {}
  });

  // Trim whitespace and limit length
  return sanitized.trim().substring(0, 20);
}

module.exports = {
  generateRoomCode,
  getPlayerFromSocket,
  sanitizePlayerName
};
