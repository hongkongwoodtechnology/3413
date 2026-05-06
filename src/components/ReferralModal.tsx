
"use client";

import { Gift } from "lucide-react";
import Link from "next/link";

export function ReferralModal() {
    return (
        <Link href="/referral">
            <button className="relative p-2 rounded-xl bg-gradient-to-br from-primary-purple/20 to-primary-blue/20 border border-primary-purple/30 hover:border-primary-purple hover:bg-primary-purple/30 transition-all group cursor-pointer">
                <Gift className="h-5 w-5 text-primary-purple group-hover:text-white transition-colors" />
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-error rounded-full animate-pulse border border-neutral-900"></span>
            </button>
        </Link>
    );
}
