import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { type, data, email } = await request.json();
    
    // Symulacja wysyłania raportu email
    console.log(`Wysyłanie raportu ${type} na email: ${email}`);
    console.log('Dane raportu:', data);
    
    // Tu można dodać integrację z serwisem email (SendGrid, AWS SES, etc.)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Raport wysłany pomyślnie' 
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Błąd wysyłania raportu' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const date = searchParams.get('date');
  
  // Symulacja generowania raportu
  const reportData = {
    type,
    date,
    generated: new Date().toISOString(),
    data: {
      totalDowntime: 120,
      totalStops: 8,
      avgDowntime: 15
    }
  };
  
  return NextResponse.json(reportData);
}