/**
 * Advanced Predictor Integration with Supabase
 * Fetches bookings and generates comeback predictions
 */

import { supabase } from '../../supabase';
import { predictAllComebacks, getComebackTable } from './advancedClientPredictor';

/**
 * Fetch bookings and get comeback predictions for all customers
 * @param {string} profileId - The nail tech's profile ID
 * @returns {Object} Result with predictions array
 */
export const fetchAndPredictAllComebacks = async (profileId) => {
  try {
    // Fetch bookings from Supabase
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching bookings:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }

    if (!bookings || bookings.length === 0) {
      return {
        success: true,
        message: 'No bookings found for this profile',
        data: []
      };
    }

    // Get predictions for all customers
    const predictions = predictAllComebacks(bookings);
    
    console.log('✅ Comeback predictions loaded:', predictions.length, 'customers');

    return {
      success: true,
      data: predictions
    };
  } catch (error) {
    console.error('Error predicting comebacks:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

/**
 * Get clean comeback table (name and percentage only)
 * @param {string} profileId - The nail tech's profile ID
 * @returns {Array} Table data with name and percentage
 */
export const getComebackPredictionTable = async (profileId) => {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true });

    if (error || !bookings) {
      return [];
    }

    return getComebackTable(bookings);
  } catch (error) {
    console.error('Error getting comeback table:', error);
    return [];
  }
};
