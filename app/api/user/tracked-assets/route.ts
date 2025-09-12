import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireAuth } from '@/lib/middleware';

interface TrackedAsset {
  type: 'stock' | 'crypto' | 'forex';
  symbol: string;
  addedAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    
    const session = authResult.session;
    // Check if session and user exist
    if (!session || !session.user || !('id' in session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    await dbConnect();
    
    const user = await User.findById(session.user.id as string);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ trackedAssets: user.trackedAssets });
  } catch (error) {
    console.error('Error fetching tracked assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    
    const session = authResult.session;
    // Check if session and user exist
    if (!session || !session.user || !('id' in session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { type, symbol } = await request.json();
    
    if (!type || !symbol) {
      return NextResponse.json({ error: 'Type and symbol are required' }, { status: 400 });
    }
    
    await dbConnect();
    
    const user = await User.findByIdAndUpdate(
      session.user.id as string,
      { 
        $addToSet: { 
          trackedAssets: { 
            type, 
            symbol, 
            addedAt: new Date() 
          } 
        } 
      },
      { new: true }
    );
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ trackedAssets: user.trackedAssets });
  } catch (error) {
    console.error('Error adding tracked asset:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    
    const session = authResult.session;
    // Check if session and user exist
    if (!session || !session.user || !('id' in session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }
    
    await dbConnect();
    
    const user = await User.findByIdAndUpdate(
      session.user.id as string,
      { $pull: { trackedAssets: { symbol } } },
      { new: true }
    );
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ trackedAssets: user.trackedAssets });
  } catch (error) {
    console.error('Error removing tracked asset:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}