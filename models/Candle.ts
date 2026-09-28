import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Persistent candle storage (Phase 1, §12/§13/§39).
 *
 * One normalized, provider-independent model. Identity/uniqueness:
 *   symbol + interval + timestamp + adjustmentMode
 *
 * The supplying provider is recorded per candle (`sourceProvider`) but does
 * NOT participate in identity: overlapping datasets are deduplicated by the
 * canonical-source policy in lib/market-data/candles.ts — one canonical
 * source per asset class wins, the other is used only for validation.
 *
 * `adjusted` indicates split/dividend adjustment where the provider states it;
 * `unknown` is valid and stored explicitly so it is never silently assumed.
 */

export type CandleInterval = '1day';
export type AdjustmentMode = 'adjusted' | 'unadjusted' | 'unknown';
export type ProviderId = 'twelvedata' | 'eulerpool';

export interface ICandle extends Document {
  symbol: string;
  /** Candle open time (UTC midnight for 1day bars). */
  timestamp: Date;
  interval: CandleInterval;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  adjustmentMode: AdjustmentMode;
  /** Provider that supplied this candle (provenance). */
  sourceProvider: ProviderId;
  /** When we fetched and stored it. */
  retrievedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CandleSchema = new Schema<ICandle>(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    interval: {
      type: String,
      required: true,
      enum: ['1day'],
      default: '1day',
    },
    open: { type: Number, required: true, min: 0 },
    high: { type: Number, required: true, min: 0 },
    low: { type: Number, required: true, min: 0 },
    close: { type: Number, required: true, min: 0 },
    volume: {
      type: Number,
      default: null,
      validate: {
        validator: (v: number | null) => v === null || (Number.isFinite(v) && v >= 0),
        message: 'volume must be a non-negative number or null',
      },
    },
    adjustmentMode: {
      type: String,
      enum: ['adjusted', 'unadjusted', 'unknown'],
      default: 'unknown',
      required: true,
    },
    sourceProvider: {
      type: String,
      required: true,
      enum: ['twelvedata', 'eulerpool'],
    },
    retrievedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Identity: one candle per symbol+interval+timestamp+adjustmentMode (§12).
CandleSchema.index({ symbol: 1, interval: 1, timestamp: 1, adjustmentMode: 1 }, { unique: true });
// Range-scan support for analytics reads.
CandleSchema.index({ symbol: 1, interval: 1, timestamp: -1 });

// Prevent model recompilation in development
const Candle: Model<ICandle> =
  mongoose.models.Candle || mongoose.model<ICandle>('Candle', CandleSchema);

export default Candle;
