import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/middleware';

export async function PUT(request: NextRequest) {
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
    
    const { name, isPublic } = await request.json();
    
    await dbConnect();
    
    const user = await User.findByIdAndUpdate(
      session.user.id as string,
      { 
        $set: { 
          name: name || undefined,
          isPublic: typeof isPublic === 'boolean' ? isPublic : undefined
        } 
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}