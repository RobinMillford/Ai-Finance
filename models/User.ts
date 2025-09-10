import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  emailVerified?: Date;
  emailVerificationToken?: string;
  emailVerificationTokenExpiry?: Date;
  watchlist: string[]; // Array of stock/crypto/forex symbols
  trackedAssets: {
    type: string; // 'stock', 'crypto', 'forex'
    symbol: string;
    addedAt: Date;
  }[];
  isPublic?: boolean; // Whether the profile is public
  notificationPreferences?: {
    email: boolean;
    marketAlerts: boolean;
    priceChanges: boolean;
    portfolioUpdates: boolean;
    aiRecommendations: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
    },
    image: {
      type: String,
    },
    emailVerified: {
      type: Date,
    },
    emailVerificationToken: {
      type: String,
    },
    emailVerificationTokenExpiry: {
      type: Date,
    },
    watchlist: [
      {
        type: String,
      },
    ],
    trackedAssets: [
      {
        type: {
          type: String,
          enum: ['stock', 'crypto', 'forex'],
        },
        symbol: String,
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      marketAlerts: { type: Boolean, default: true },
      priceChanges: { type: Boolean, default: true },
      portfolioUpdates: { type: Boolean, default: true },
      aiRecommendations: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// Create and export the model
export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);