# Advanced Client Comeback Predictor

A simple and realistic prediction model that estimates the likelihood of a customer returning for another appointment based on three key variables.

## How It Works

The comeback prediction is calculated using three scoring components that add up to a maximum of 100%:

### 1. **Number of Bookings** (Fixed Scores)
The total number of appointments a customer has booked:
- **1 booking**: 15 points
- **2 bookings**: 25 points
- **3 bookings**: 35 points
- **4+ bookings**: 40 points

*Rationale:* Customers with more appointment history are more likely to return.

### 2. **Pattern of Booking** (1-30 Points)
Measures how consistent/predictable a customer's booking pattern is based on the standard deviation of days between bookings:
- **Perfect consistency** (low deviation): 30 points
- **High variation** (high deviation): 1 point

*Rationale:* Customers with regular booking patterns are more predictable and likely to return.

### 3. **Days Since Last Booked** (Recency Score)
How recently a customer had their last appointment:
- **0-30 days**: 25 points (very recent)
- **31-60 days**: 15 points
- **61-90 days**: 5 points
- **90+ days**: 0 points

*Rationale:* Recent bookings indicate active engagement; older bookings suggest the customer may have lost interest.

## Features

- **Realistic Scoring**: Single bookings score only 15 points (15%), making predictions more realistic
- **Clean Table Display**: Shows only customer name and comeback percentage
- **Visual Progress Bars**: Color-coded percentage bars (green for high, orange for medium, red for low)
- **No Overpredicting**: Customers with limited history won't show inflated scores
- **Simple Integration**: Easy Supabase integration for automatic predictions

## Core Functions

### `predictClientComeback(bookings, customerName)`

Predicts comeback percentage for a single customer.

**Parameters:**
- `bookings` (Array): Array of booking objects
- `customerName` (String): Customer name to analyze

**Returns:**
```javascript
{
  customerName: 'John Doe',
  comebackPercentage: 65,  // 0-100
  scores: {
    numberOfBookings: 35,
    pattern: 20,
    daysSinceLast: 10
  },
  totalBookings: 3
}
```

### `predictAllComebacks(bookings)`

Gets predictions for all unique customers, sorted by comeback percentage (highest first).

**Returns:** Sorted array of predictions

### `getComebackTable(bookings)`

Returns clean table data with only name and percentage.

**Returns:** Array of `{name, percentage}` objects

## Supabase Integration

### `fetchAndPredictAllComebacks(profileId)`

Fetches bookings from Supabase and generates predictions.

```javascript
import { fetchAndPredictAllComebacks } from '@/lib/predictions/advancedPredictor/integration';

const result = await fetchAndPredictAllComebacks(nailTechId);
console.log(result.data); // Array of predictions
```

### `getComebackPredictionTable(profileId)`

Gets clean table data directly from Supabase.

```javascript
import { getComebackPredictionTable } from '@/lib/predictions/advancedPredictor/integration';

const tableData = await getComebackPredictionTable(nailTechId);
// Output: [{ name: 'John', percentage: 65 }, ...]
```

## Example Calculations

### Customer 1: One-Time Visitor
- 1 booking: **15 pts**
- Low consistency (only one booking): **1 pt**
- Booked 5 days ago: **25 pts**
- **Total: 41%** (LOW)

### Customer 2: Regular Client
- 3 bookings: **35 pts**
- High consistency (books every 30 days): **28 pts**
- Booked 10 days ago: **25 pts**
- **Total: 88%** (HIGH)

### Customer 3: Returning Customer
- 2 bookings: **25 pts**
- Moderate consistency: **15 pts**
- Booked 50 days ago: **15 pts**
- **Total: 55%** (MODERATE)

## Dashboard Display

The prediction shows in the "🔮 Comeback Predictions" tab with:
- **Customer Name**: Full name of the customer
- **Comeback %**: Percentage likelihood they'll return
- **Visual Bar**: Color-coded progress bar
  - 🟢 Green (70-100%): High likelihood
  - 🟡 Orange (40-69%): Moderate likelihood
  - 🔴 Red (0-39%): Low likelihood

## Advantages Over Previous Model

1. **More Realistic**: Single bookings don't score unrealistically high
2. **Simpler**: Three variables instead of complex algorithms
3. **Cleaner Display**: Just customer name and percentage in a table
4. **Better Insights**: One-time visitors show 15-40%, regular customers show 60-88%
5. **No Confusion**: Clear, understandable scoring logic

## Notes

- Requires minimum 1 booking for prediction (though single bookings have low scores)
- Recency is heavily weighted (important indicator)
- Consistency requires at least 2 bookings to measure meaningfully
- Predictions update automatically when new bookings are added
- Maximum possible score: 100 (40+30+25 = 95, plus small buffer)
