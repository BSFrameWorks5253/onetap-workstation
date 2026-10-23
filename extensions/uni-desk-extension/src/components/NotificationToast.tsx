import React from 'react';
import { NotificationPayload } from '../types';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface NotificationToastProps {
  notifications: NotificationPayload[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notifications,
  onDismiss,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-auto">
      {notifications.map((n) => {
        let Icon = CheckCircle2;
        let borderClass = 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200 shadow-emerald-500/10';
        if (n.type === 'error') {
          Icon = AlertCircle;
          borderClass = 'border-rose-500/40 bg-rose-950/90 text-rose-200 shadow-rose-500/10';
        } else if (n.type === 'warning') {
          Icon = AlertTriangle;
          borderClass = 'border-amber-500/40 bg-amber-950/90 text-amber-200 shadow-amber-500/10';
        } else if (n.type === 'info') {
          Icon = Info;
          borderClass = 'border-indigo-500/40 bg-indigo-950/90 text-indigo-200 shadow-indigo-500/10';
        }

        return (
          <div
            key={n.id}
            className={`flex items-start justify-between gap-3 p-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all animate-modal-pop ${borderClass}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-tight">{n.message}</span>
                {n.details && (
                  <span className="text-[11px] opacity-80 mt-0.5 leading-normal">{n.details}</span>
                )}
              </div>
            </div>

            <button
              onClick={() => onDismiss(n.id)}
              className="opacity-60 hover:opacity-100 p-1 rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
