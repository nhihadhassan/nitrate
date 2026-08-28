'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { setNetworkFlagAction } from '@/server/actions/network';
import type { NetworkSurface, ProductFlagMode } from '@/lib/network';

export function NetworkFlagControl({ surface, mode }: { surface: NetworkSurface; mode: ProductFlagMode }) { const [pending,startTransition]=useTransition();const router=useRouter();const toast=useToast();return <select aria-label={`Mode for ${surface}`} disabled={pending} value={mode} onChange={(event)=>startTransition(async()=>{const result=await setNetworkFlagAction({surface,mode:event.target.value});if(!result.ok)return toast({message:result.error,tone:'error'});toast({message:'Network flag updated',tone:'success'});router.refresh()})} className="min-h-11 rounded-md border border-line bg-canvas px-3 text-sm"><option value="auto">Auto</option><option value="forced_on">Forced on</option><option value="forced_off">Forced off</option></select> }
