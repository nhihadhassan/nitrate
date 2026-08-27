import { NextResponse } from 'next/server';
import { env } from '@/env';
import { evaluateNetworkEligibility } from '@/server/services/network';

export const runtime='nodejs'; export const dynamic='force-dynamic'; export const maxDuration=60;
export async function GET(request:Request){const secret=env.cronSecret;if(secret&&request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'unauthorized'},{status:401});if(!secret&&env.isProduction)return NextResponse.json({error:'CRON_SECRET is not configured'},{status:503});try{return NextResponse.json({ok:true,...await evaluateNetworkEligibility()});}catch(error){console.error('[cron] network eligibility failed',error);return NextResponse.json({ok:false,error:'Eligibility evaluation failed'},{status:500})}}
