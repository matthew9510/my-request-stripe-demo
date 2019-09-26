'use strict';

const config = require('../config');
const stripe = require('stripe')(config.stripe.secretKey);
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Use native promises.
mongoose.Promise = global.Promise;

// Define the Passenger schema.
const SongInfoSchema = new Schema({
  title: {type: String, required: true},
  artist: {type: String, required: true},
});

// Return a passenger name for display.
SongInfoSchema.methods.displayName = function() {
  return `${this.title} - ${this.artist}`;
};

// Find a random passenger.
SongInfoSchema.statics.getRandom = async function() {
  try {
    // Count all the passengers.
    const count = await SongInfo.count().exec();
    if (count === 0) {
      // Create default passengers.
      await SongInfo.insertDefaultSongInfo();
    }
    // Returns a document after skipping a random amount.
    const random = Math.floor(Math.random() * count);
    return SongInfo.findOne().skip(random).exec();
  } catch (err) {
    console.log(err);
  }
};

// Create a few default passengers for the platform to simulate rides.
SongInfoSchema.statics.insertDefaultSongInfo = async function() {
  try {
    const data = [{
      title: 'Gypsy Eyes',
      artist: 'Jimi Hendrix',
    }, {
      title: 'Money',
      artist: 'Pink Floyd',
    }, {
      title: 'No Quarter',
      artist: 'Led Zeppelin',
    }, {
      title: 'Riders on the storm',
      artist: 'The Doors',
    }, {
      title: 'Down by the river',
      artist: 'Neil Young',
    }];
    for (let object of data) {
      const songInfo = new SongInfo(object);
      await songInfo.save();
    }
  } catch (err) {
    console.log(err);
  }
};

const SongInfo = mongoose.model('SongInfo', SongInfoSchema);

module.exports = SongInfo;
