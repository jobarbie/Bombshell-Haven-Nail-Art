/**
 * Advanced Client Return Prediction Engine
 * Predicts whether a customer is likely to comeback based on:
 * 1. Number of bookings
 * 2. Pattern of booking (consistency)
 * 3. Days since last booked
 * 4. Customer ratings affecting the recency score
 */

/**
 * Calculates return percentage for a single customer
 * @param {Array} bookings - Array of booking objects with customer_name, created_at, status, rating
 * @param {string} customerName - Name of the customer to analyze
 * @returns {Object} Prediction object with name and comeback percentage
 */
export const predictClientComeback = (bookings, customerName) => {
  // Validate input
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return {
      customerName,
      comebackPercentage: 0,
      message: 'No booking history available'
    };
  }

  // Filter bookings for the specific customer
  const customerBookings = bookings
    .filter(booking => booking.customer_name === customerName)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (customerBookings.length === 0) {
    return {
      customerName,
      comebackPercentage: 0,
      message: 'No booking history for this customer'
    };
  }

  // Calculate individual scores
  const numberOfBookingsScore = calculateNumberOfBookingsScore(customerBookings.length);
  const patternScore = calculatePatternScore(customerBookings);
  const ratingWeight = calculateRatingWeight(customerBookings);
  const daysSinceLastScore = calculateDaysSinceLastScore(customerBookings, ratingWeight);

  // Total comeback percentage (sum of all scores)
  const comebackPercentage = numberOfBookingsScore + patternScore + daysSinceLastScore;

  return {
    customerName,
    comebackPercentage: Math.min(comebackPercentage, 100), // Cap at 100%
    scores: {
      numberOfBookings: numberOfBookingsScore,
      pattern: patternScore,
      daysSinceLast: daysSinceLastScore
    },
    totalBookings: customerBookings.length
  };
};

/**
 * Calculate score based on number of bookings
 * 1 booking = 15, 2 = 25, 3 = 35, 4+ = 40
 * @private
 */
function calculateNumberOfBookingsScore(totalBookings) {
  if (totalBookings === 1) return 15;
  if (totalBookings === 2) return 25;
  if (totalBookings === 3) return 35;
  if (totalBookings >= 4) return 40;
  return 0;
}

/**
 * Calculate pattern score (1-30 based on consistency)
 * Measures how regular/predictable the booking pattern is within the last 4-6 months
 * @private
 */
function calculatePatternScore(customerBookings) {
  if (customerBookings.length < 2) {
    return 1; // Minimum score for insufficient data
  }

  // Filter bookings to only those within the last 4-6 months (150-180 days)
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000));
  const recentBookings = customerBookings
    .filter(booking => new Date(booking.created_at) >= sixMonthsAgo)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (recentBookings.length < 2) {
    return 1; // Minimum score for insufficient recent data
  }

  // Calculate days between bookings
  const bookingDates = recentBookings.map(b => new Date(b.created_at));
  const daysBetweenBookings = [];

  for (let i = 1; i < bookingDates.length; i++) {
    const daysDiff = (bookingDates[i] - bookingDates[i - 1]) / (1000 * 60 * 60 * 24);
    daysBetweenBookings.push(daysDiff);
  }

  if (daysBetweenBookings.length === 0) {
    return 1;
  }

  // Calculate standard deviation (consistency measure)
  const average = daysBetweenBookings.reduce((a, b) => a + b, 0) / daysBetweenBookings.length;
  const variance = daysBetweenBookings.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / daysBetweenBookings.length;
  const standardDeviation = Math.sqrt(variance);

  // Score based on consistency (lower deviation = higher score)
  // Perfect consistency (0 deviation) = 30 points
  // High deviation (50+ days) = 1 point
  const maxDeviation = 50;
  const patternScore = Math.max(30 - (standardDeviation / maxDeviation) * 29, 1);

  return Math.round(patternScore);
}

/**
 * Calculate score based on days since last booking
 * 0-30 days = 25, 31-60 days = 15, 61-90 days = 5, 90+ days = 0
 * @private
 */
function calculateDaysSinceLastScore(customerBookings, ratingWeight) {
  const lastBooking = new Date(customerBookings[customerBookings.length - 1].created_at);
  const daysSinceLast = (new Date() - lastBooking) / (1000 * 60 * 60 * 24);

  const weightedScore = (baseScore) => Math.round(baseScore * ratingWeight);

  if (daysSinceLast <= 30) {
    return weightedScore(25);
  } else if (daysSinceLast <= 60) {
    return weightedScore(15);
  } else if (daysSinceLast <= 90) {
    return weightedScore(5);
  } else {
    return 0;
  }
}

/**
 * Calculate a rating weight for recency scoring.
 * Higher average ratings increase the days-since-last-booked score.
 * @private
 */
function calculateRatingWeight(customerBookings) {
  const ratedBookings = customerBookings.filter(
    (booking) => typeof booking.rating === 'number' && booking.rating >= 1 && booking.rating <= 5
  );

  if (ratedBookings.length === 0) {
    return 1; // Neutral weight when no rating data exists
  }

  const averageRating =
    ratedBookings.reduce((sum, booking) => sum + booking.rating, 0) / ratedBookings.length;

  // Convert 1-5 stars into a 0.2-1.0 weight range.
  // Example: 1 star -> 0.2, 3 stars -> 0.6, 5 stars -> 1.0
  return Math.max(0.2, Math.min(1, averageRating / 5));
}

/**
 * Get comeback predictions for all customers
 * @param {Array} bookings - All booking records
 * @returns {Array} Array of predictions sorted by comeback percentage (highest first)
 */
export const predictAllComebacks = (bookings) => {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return [];
  }

  // Get unique customer names
  const uniqueCustomers = [...new Set(bookings.map(b => b.customer_name))];

  // Create predictions for each customer
  const predictions = uniqueCustomers
    .map(customerName => predictClientComeback(bookings, customerName))
    .sort((a, b) => b.comebackPercentage - a.comebackPercentage);

  return predictions;
};

/**
 * Get comeback predictions for a specific nail tech
 * Returns only customer name and comeback percentage for clean table display
 * @param {Array} bookings - All booking records
 * @returns {Array} Array with only name and percentage
 */
export const getComebackTable = (bookings) => {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return [];
  }

  return predictAllComebacks(bookings).map(prediction => ({
    name: prediction.customerName,
    percentage: prediction.comebackPercentage
  }));
};
