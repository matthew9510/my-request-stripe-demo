'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const express = require('express');
const router = express.Router();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const Pilot = require('../../models/pilot');
const Ride = require('../../models/ride');
const Passenger = require('../../models/passenger');
const Song = require("../../models/song");
const SongInfo = require("../../models/songInfo");
const querystring = require('querystring');

// Middleware: require a logged-in pilot
function pilotRequired(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/pilots/login');
  }
  next();
}

/**
 * GET /pilots/dashboard
 *
 * Show the Dashboard for the logged-in pilot with the overview,
 * their ride history, and the ability to simulate a test ride.
 *
 * Use the `pilotRequired` middleware to ensure that only logged-in
 * pilots can access this route.
 */
router.get('/dashboard', pilotRequired, async (req, res) => {
  const pilot = req.user;
  // Retrieve the balance from Stripe
  const balance = await stripe.balance.retrieve({
    stripe_account: pilot.stripeAccountId,
  });
  // Fetch the performances played songs
  const songs = await pilot.listRecentPlayedSongs();
  const songsTotalAmount = songs.reduce((a, b) => {
    return a + b.amount - 100;
  }, 0);
  const [showBanner] = req.flash('showBanner');
  // There is one balance for each currencies used: as this 
  // demo app only uses USD we'll just use the first object
  res.render('dashboard', {
    pilot: pilot,
    balanceAvailable: balance.available[0].amount,
    balancePending: balance.pending[0].amount,
    songsTotalAmount: songsTotalAmount,
    songs: songs,
    showBanner: !!showBanner || req.query.showBanner,
  });
});

/**
 * GET /pilots/dashboard-requests
 *
 * Show the Dashboard for the logged-in pilot with the overview,
 * their ride history, and the ability to simulate a test ride.
 *
 * Use the `pilotRequired` middleware to ensure that only logged-in
 * pilots can access this route.
 */
router.get('/dashboard-requests', pilotRequired, async (req, res) => {
  const pilot = req.user;
  console.log("\nreq.app.locals.currentSong", req.app.locals.currentSong)
  // Retrieve the balance from Stripe
  const balance = await stripe.balance.retrieve({
    stripe_account: pilot.stripeAccountId,
  });
  // Fetch the pilot's recent rides
  const songs = await pilot.listRecentSongs();
  const songsTotalAmount = songs.reduce((a, b) => {
    return a + b.amount - 100;
  }, 0);
  // There is one balance for each currencies used: as this 
  // demo app only uses USD we'll just use the first object
  res.render('dashboard-requests', {
    pilot: pilot,
    balanceAvailable: balance.available[0].amount,
    balancePending: balance.pending[0].amount,
    songsTotalAmount: songsTotalAmount,
    songs: songs,
    currentSong: req.app.locals.currentSong
  });
});

/**
 * Helper function to reject the charge and redirect 
 */
function rejectCharge(song, req, res){
  console.log("\ninside reject charge\n Song:\n", song)
  console.log("\nstripe charge id:\n", song.stripeChargeId)

  stripe.refunds.create({
    charge: song.stripeChargeId,
    amount: song.amount,
    reason: "requested_by_customer"
  }, async function(err, refund) {
    // asynchronously called
    // if(err) return new Error(err)
    if(err) console.log(err)
    else{
      // todo - still implement a link to the refund object
      //song.refund = refund;
      song.refund = true;

      await song.save()
      console.log('refund done')
      console.log(song.refund)

      // redirect to dashboard requests where we filter not showing refunds
      
      res.redirect('/pilots/dashboard-requests')
    }
  });
}

/**
 * POST /pilots/reject-request
 *
 * Cancel the Stripe authorization 
 */
router.post('/reject-request', pilotRequired,  async(req, res, next) => {
  console.log("Inside /reject-request")
  const pilot = req.user;
  const songs = await pilot.listRecentSongs();
  for(let song of songs){
    if (song._id == req.body.songid){ // Note: song._id is an object and req.body.songid is a string
      console.log("Found The SONG!")
      console.log(song)
      try{
        rejectCharge(song, req, res);
      } catch(err){
        console.log(err, "couldn't find song")
        res.redirect('/pilots/dashboard-requests')
      }  
    }      
  }
});

/**
 * Helper function to capture the charge and redirect 
 */
function captureCharge(song, req, res){
  console.log("\ninside capture charge", song)
  const charge = stripe.charges.capture(song.stripeChargeId,  {application_fee: 100}, async (err, charge)=>{
   if(err) return new Error(err) // do we need to throw?
   else { 
    req.app.locals.currentSong = song
     song.played = true;
     await song.save() // acts blocking 
     res.redirect('/pilots/dashboard-requests')
    ;}

  })
}
/**
 * POST /pilots/auth-capture
 *
 * Capture the authorized charge 
 */
router.post('/auth-capture', pilotRequired,  async(req, res, next) => {
  const pilot = req.user;
  const songs = await pilot.listRecentSongs();
  for(let song of songs){
    if (song._id == req.body.songid){ // Note: song._id is an object and req.body.songid is a string
      console.log("Found The SONG!")
      console.log(song)
      try{
        captureCharge(song, req, res);
      } catch(err){
        console.log(err)
        res.redirect('/pilots/dashboard-requests')
      }  
    }      
  }
});

/**
 * POST /pilots/auth-request
 *
 * Generate a test request
 */
router.post('/auth-request', pilotRequired, async (req, res, next) => {
  const pilot = req.user;
  // Find a random passenger
  const passenger = await Passenger.getRandom();
  const songInfo = await SongInfo.getRandom();
  // Create a new ride for the pilot and this random passenger
  const song = new Song({
    pilot: pilot.id,
    passenger: passenger.id,
    songInfo: songInfo.id,
    // Generate a random amount between $10 and $100 for this ride
    amount: getRandomInt(1000, 10000),
  });
  // Save the ride
  await song.save(); // saves to the database
  try {
    // Get a test source, using the given testing behavior
    let source;
    if (req.body.immediate_balance) {
      source = getTestSource('immediate_balance'); // be cautious
    } else if (req.body.payout_limit) {
      source = getTestSource('payout_limit');
    }
    // Create a charge and set its destination to the pilot's account
    const charge = await stripe.charges.create({
      source: source,
      amount: song.amount,
      currency: song.currency,
      description: config.appName,
      statement_descriptor: config.appName,
      capture: false,
      // The destination parameter directs the transfer of funds from platform to pilot
      transfer_data: {
        // Send the amount for the pilot after collecting a 20% platform fee:
        // the `amountForPilot` method simply computes `ride.amount * 0.8`
        //amount: song.amountForPilot(),
        // The destination of this charge is the pilot's Stripe account
        destination: pilot.stripeAccountId,
      },
    });
    // Add the Stripe charge reference to the ride and save it
    song.stripeChargeId = charge.id;
    song.save();
  } catch (err) {
    console.log(err);
    // Return a 402 Payment Required error code
    res.sendStatus(402);
    next(`Error adding token to customer: ${err.message}`);
  }
  res.redirect('/pilots/dashboard-requests');
})

/**
 * POST /pilots/rides
 *
 * Generate a test ride with sample data for the logged-in pilot.
 */
router.post('/rides', pilotRequired, async (req, res, next) => {
  const pilot = req.user;
  // Find a random passenger
  const passenger = await Passenger.getRandom();
  // Create a new ride for the pilot and this random passenger
  const ride = new Ride({
    pilot: pilot.id,
    passenger: passenger.id,
    // Generate a random amount between $10 and $100 for this ride
    amount: getRandomInt(1000, 10000),
  });
  // Save the ride
  await ride.save();
  try {
    // Get a test source, using the given testing behavior
    let source;
    if (req.body.immediate_balance) {
      source = getTestSource('immediate_balance');
    } else if (req.body.payout_limit) {
      source = getTestSource('payout_limit');
    }
    // Create a charge and set its destination to the pilot's account
    const charge = await stripe.charges.create({
      source: source,
      amount: ride.amount,
      currency: ride.currency,
      description: config.appName,
      statement_descriptor: config.appName,
      // The destination parameter directs the transfer of funds from platform to pilot
      transfer_data: {
        // Send the amount for the pilot after collecting a 20% platform fee:
        // the `amountForPilot` method simply computes `ride.amount * 0.8`
        amount: ride.amountForPilot(),
        // The destination of this charge is the pilot's Stripe account
        destination: pilot.stripeAccountId,
      },
    });
    // Add the Stripe charge reference to the ride and save it
    ride.stripeChargeId = charge.id;
    ride.save();
  } catch (err) {
    console.log(err);
    // Return a 402 Payment Required error code
    res.sendStatus(402);
    next(`Error adding token to customer: ${err.message}`);
  }
  res.redirect('/pilots/dashboard');
});

/**
 * GET /pilots/signup
 *
 * Display the signup form on the right step depending on the current completion.
 */
router.get('/signup', (req, res) => {
  let step = 'account';
  // Naive way to identify which step we're on: check for the presence of user profile data
  if (req.user) {
    if (
      req.user.type === 'individual'
        ? !req.user.firstName || !req.user.lastName
        : !req.user.businessName
    ) {
      step = 'profile';
    } else if (!req.user.stripeAccountId) {
      step = 'payments';
    } else {
      step = 'done';
    }
  }
  res.render('signup', {step: step});
});

/**
 * POST /pilots/signup
 *
 * Create a user and update profile information during the pilot onboarding process.
 */
router.post('/signup', async (req, res, next) => {
  const body = Object.assign({}, req.body, {
    // Use `type` instead of `pilot-type` for saving to the DB.
    // type: req.body['pilot-type'],
    // 'pilot-type': undefined,
  });

  // Check if we have a logged-in pilot
  let pilot = req.user;
  if (!pilot) {
    try {
      // Try to create and save a new pilot
      pilot = new Pilot(body);
      pilot = await pilot.save()
      // Sign in and redirect to continue the signup process
      req.logIn(pilot, err => {
        if (err) next(err);
        return res.redirect('/pilots/signup');
      });
    } catch (err) {
      // Show an error message to the user
      const errors = Object.keys(err.errors).map(field => err.errors[field].message);
      res.render('signup', { step: 'account', error: errors[0] });
    }
  } 
  else {
    try {
      // Try to update the logged-in pilot using the newly entered profile data
      pilot.set(body);
      await pilot.save();
      return res.redirect('/pilots/stripe/authorize');
    } catch (err) {
      next(err);
    }
  }
});

/**
 * GET /pilots/login
 *
 * Simple pilot login.
 */
router.get('/login', (req, res) => {
  res.render('login');
});

/**
 * GET /pilots/login
 *
 * Simple pilot login.
 */
router.post(
  '/login',
  passport.authenticate('pilot-login', {
    successRedirect: '/pilots/dashboard',
    failureRedirect: '/pilots/login',
  })
);

/**
 * GET /pilots/logout
 *
 * Delete the pilot from the session.
 */
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

// Serialize the pilot's sessions for Passport
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    let user = await Pilot.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Define the login strategy for pilots based on email and password
passport.use('pilot-login', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  let user;
  try {
    user = await Pilot.findOne({email});
    if (!user) {
      return done(null, false, { message: 'Unknown user' });
    }
  } catch (err) {
    return done(err);
  }
  if (!user.validatePassword(password)) {
    return done(null, false, { message: 'Invalid password' });
  }
  return done(null, user);
}));

// Function that returns a test card token for Stripe
function getTestSource(behavior) {
  // Important: We're using static tokens based on specific test card numbers
  // to trigger a special behavior. This is NOT how you would create real payments!
  // You should use Stripe Elements or Stripe iOS/Android SDKs to tokenize card numbers.
  // Use a static token based on a test card: https://stripe.com/docs/testing#cards
  var source = 'tok_visa';
  // We can use a different test token if a specific behavior is requested
  if (behavior === 'immediate_balance') {
    source = 'tok_bypassPending';
  } else if (behavior === 'payout_limit') {
    source = 'tok_visa_triggerTransferBlock';
  }
  return source;
}

// Return a random int between two numbers
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = router;
