import mongoose from 'mongoose';
import { env } from './env';

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
declare global {
  var mongoose: any; // This must be a `var` and not a `let / const`
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  // Runtime check for MONGODB_URI
  if (!env.mongodb.uri) {
    throw new Error(
      'MONGODB_URI environment variable is not defined.\n' +
      'Please set it in your environment or .env.local file.'
    );
  }
  
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Fail fast if the cluster is unreachable (avoids silent hangs)
      serverSelectionTimeoutMS: 5_000,
      // Close sockets that have been idle longer than this
      socketTimeoutMS: 45_000,
      // Time to wait for an initial connection to be established
      connectTimeoutMS: 10_000,
    };

    cached.promise = mongoose.connect(env.mongodb.uri, opts).then((mongoose) => {
      return mongoose;
    });
  }
  
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;