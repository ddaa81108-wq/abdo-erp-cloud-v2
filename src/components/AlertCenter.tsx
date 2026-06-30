import React, { useState } from 'react';
import { AlertTriangle, Bell, CheckCircle, Flame, ShieldAlert, Sparkles, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { ERPState, DebtTransaction, PurchaseRecord } from '../types';

interface AlertCenterProps {
  state: ERPState;
  onNavigateToSection: (section: string) => void;
  onPostPurchaseToTreasury?: (purchaseId: string) => void;
}

export default function AlertCenter({
  state,
  onNavigateToSection,
  onPostPurchaseToTreasury
}: AlertCenterProps) {
  // Clear the smart accounting alerts center as requested
  return null;
}
