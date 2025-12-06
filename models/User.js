const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  apiKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
