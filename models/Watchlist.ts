import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWatchlistAsset {
  symbol: string;
  assetType: 'stock' | 'crypto' | 'forex';
  addedAt: Date;
  notes?: string;
  alertPrice?: number;
}

export interface IWatchlist extends Document {
  userId: string;
  name: string;
  assets: IWatchlistAsset[];
  createdAt: Date;
  updatedAt: Date;
}

const WatchlistAssetSchema = new Schema<IWatchlistAsset>({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
  },
  assetType: {
    type: String,
    required: true,
    enum: ['stock', 'crypto', 'forex'],
  },
  addedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  notes: {
    type: String,
  },
  alertPrice: {
    type: Number,
    min: 0,
  },
});

const WatchlistSchema = new Schema<IWatchlist>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    assets: {
      type: [WatchlistAssetSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
WatchlistSchema.index({ userId: 1, createdAt: -1 });

// Prevent model recompilation in development
const Watchlist: Model<IWatchlist> =
  mongoose.models.Watchlist || mongoose.model<IWatchlist>('Watchlist', WatchlistSchema);

export default Watchlist;
