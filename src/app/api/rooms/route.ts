import { NextResponse } from 'next/server';
import { getRooms, getRoom } from '@/lib/socket';

export async function GET() {
  const rooms = getRooms();
  return NextResponse.json(rooms);
}