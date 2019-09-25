'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Use native promises.
mongoose.Promise = global.Promise;

// Define the Ride schema.
const SongSchema = new Schema({
  pilot: { type : Schema.ObjectId, ref : 'Pilot', required: true },
  passenger: { type : Schema.ObjectId, ref : 'Passenger', required: true },
  origin: { type: [Number], index: '2d', sparse: true, default: [37.7765030, -122.3920385] },
  requestTime: { type: Date, default: new Date((new Date).getTime() + Math.floor(10 * Math.random()) * 60000) },
  amount: Number,
  currency: { type: String, default: 'usd' },
  created: { type: Date, default: Date.now },
  played: { type: Boolean, default: false},

  // Stripe charge ID corresponding to this ride.
  stripeChargeId: String
});

// Return the ride amount for the pilot after collecting 20% platform fees.
SongSchema.methods.amountForPilot = function() {
  return parseInt(this.amount * 0.8);
};

const Song = mongoose.model('Song', SongSchema);

module.exports = Song;
