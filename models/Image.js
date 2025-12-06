const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  deleteUrl: {
    type: String,
    required: true
  },
  uploaderApiKey: {
    type: String,
    required: true,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expireAt: {
    type: Date,
    default: null
  }
});

// TTL Index removed in favor of Cron job for file cleanup
// ImageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Image', ImageSchema);
