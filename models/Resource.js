const mongoose = require('mongoose');
const resourceSchema = new mongoose.Schema({
  title: String,
  description: String,
  link: String,
  category: String,
});
module.exports = mongoose.model('Resource', resourceSchema);