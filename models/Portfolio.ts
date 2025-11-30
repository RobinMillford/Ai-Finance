import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IHolding {
  symbol: string;
  assetType: 'stock' | 'crypto' | 'forex';
  quantity: number;
  purchasePrice: number;
  purchaseDate: Date;
  notes?: string;
}

export interface IPortfolio extends Document {
  userId: string;
  name: string;
  description?: string;
  holdings: IHolding[];
  createdAt: Date;
  updatedAt: Date;
}

const HoldingSchema = new Schema<IHolding>({
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
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0,
  },
  purchaseDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  notes: {
    type: String,
  },
});

const PortfolioSchema = new Schema<IPortfolio>(
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
    description: {
      type: String,
      trim: true,
    },
    holdings: {
      type: [HoldingSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
PortfolioSchema.index({ userId: 1, createdAt: -1 });

// Prevent model recompilation in development
const Portfolio: Model<IPortfolio> =
  mongoose.models.Portfolio || mongoose.model<IPortfolio>('Portfolio', PortfolioSchema);

export default Portfolio;
