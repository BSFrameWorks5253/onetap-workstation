import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  MessageCircle,
  Image as ImageIcon,
  Copy,
  Check,
  Download,
  Share2,
  ExternalLink,
  Sparkles,
  Award,
  CheckCircle2,
  Clock,
  Film,
  Camera,
  ArrowRight
} from 'lucide-react';
import type { SafarTask, Stage } from '../App';

export interface WhatsAppBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  safarName: string;
  safarYear?: string | number;
  tasks: SafarTask[];
  initialTab?: 'msg' | 'image';
  onDirectShareWhatsApp?: (text: string) => void;
  publicOrigin?: string;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w <= 0 || h <= 0) return;
  const safeR = Math.max(0, Math.min(r, w / 2, h / 2));
  try {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, safeR);
      return;
    }
  } catch {}
  ctx.beginPath();
  ctx.moveTo(x + safeR, y);
  ctx.arcTo(x + w, y, x + w, y + h, safeR);
  ctx.arcTo(x + w, y + h, x, y + h, safeR);
  ctx.arcTo(x, y + h, x, y, safeR);
  ctx.arcTo(x, y, x + w, y, safeR);
  ctx.closePath();
}

export default function WhatsAppBriefingModal({
  isOpen,
  onClose,
  safarName,
  safarYear = '1447',
  tasks = [],
  initialTab = 'msg',
  onDirectShareWhatsApp,
  publicOrigin = 'https://safar-tracker-web.vercel.app'
}: WhatsAppBriefingModalProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<'msg' | 'image'>(initialTab);
  const [imageTheme, setImageTheme] = useState<'white' | 'dark'>('white');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filter tasks for this safar (with normalization and fallback)
  const normTarget = (safarName || '').trim().toLowerCase();
  const cleanTarget = normTarget.replace(/[-_\s]+/g, ' ').trim();
  const matchedTasks = (tasks || []).filter(t => {
    if (!t) return false;
    const sName = (t.safarName || '').trim().toLowerCase();
    const sClean = sName.replace(/[-_\s]+/g, ' ').trim();
    return sName === normTarget || sClean === cleanTarget || (cleanTarget && (sClean.includes(cleanTarget) || cleanTarget.includes(sClean)));
  });
  const safarTasks = matchedTasks.length > 0 ? matchedTasks : (tasks || []);
  const total = safarTasks.length > 0 ? safarTasks.length : 1;
  const delivered = safarTasks.filter(
    t => t.stage === 'uploaded' || t.stage === 'jameya' || (t.stage as any) === 'upload' || (t.stage as any) === 'completed'
  ).length;
  const is100Done = safarTasks.length > 0 && delivered >= safarTasks.length;
  const pct = is100Done ? 100 : Math.min(100, Math.round((delivered / total) * 100));

  // Video Breakdown
  const videoJameya = safarTasks.filter(t => t.stage === 'jameya' || (t.stage as any) === 'completed').length;
  const videoUploaded = safarTasks.filter(t => t.stage === 'uploaded' || (t.stage as any) === 'upload').length;
  const videoUploadPending = safarTasks.filter(t => t.stage === 'upload_pending' || (t.stage as any) === 'rendering').length;
  const videoInProgress = safarTasks.filter(t => t.stage === 'editing').length;
  const videoEditingPending = safarTasks.filter(t => t.stage === 'editing_pending').length;

  // Photo Breakdown
  const photoUploaded = safarTasks.filter(t => t.photoStage === 'uploaded' || t.photoUploaded).length;
  const photoGiven = safarTasks.filter(t => t.photoStage === 'given_to_murtaza').length;
  const photoEdited = safarTasks.filter(t => t.photoStage === 'edited' && !t.photoUploaded).length;

  // Lists of dates
  const deliveredDates = safarTasks
    .filter(t => t.stage === 'uploaded' || t.stage === 'jameya' || (t.stage as any) === 'upload' || (t.stage as any) === 'completed')
    .map(t => t.dateFolder || (t as any).folder || (t as any).name || 'Date');
  const pendingDates = safarTasks
    .filter(t => t.stage === 'editing_pending' || t.stage === 'editing' || t.stage === 'upload_pending' || (t.stage as any) === 'rendering')
    .map(t => ({ folder: t.dateFolder || (t as any).folder || (t as any).name || 'Date', stage: t.stage }));

  // Generate Professional WhatsApp Text Message
  const generateFormattedMessage = (): string => {
    const lines: string[] = [];
    lines.push('🎬 *ONE TAP STUDIO · PRODUCTION BRIEFING*');
    lines.push('══════════════════════════════════');
    lines.push(`📍 *CAMPAIGN:* ${safarName}`);
    lines.push(`🗓️ *HIJRI ERA:* ${safarYear} H · Scheduled Dates: ${total}`);
    lines.push(`⏰ *REPORTED:* ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`);
    lines.push('');

    if (is100Done) {
      lines.push('🏆 *STATUS: 100% DONE — ALL DATES DELIVERED*');
      lines.push(`🎉 *All ${total} of ${total} scheduled date folders have been uploaded, verified, and completed!*`);
    } else {
      lines.push(`⚡ *STATUS: ${pct}% DELIVERED* (${delivered}/${total} Dates Uploaded · ${Math.max(0, total - delivered)} Pending)`);
    }
    lines.push('──────────────────────────────────');

    lines.push('📽️ *VIDEO PRODUCTION PIPELINE:*');
    if (videoJameya > 0) lines.push(`• 🏛️ *AlJamea Done:* ${videoJameya} dates`);
    if (videoUploaded > 0) lines.push(`• 🚀 *Uploaded to Cloud:* ${videoUploaded} dates`);
    if (videoUploadPending > 0) lines.push(`• 📤 *Upload Pending:* ${videoUploadPending} dates`);
    if (videoInProgress > 0) lines.push(`• 🎞️ *In Progress (Grading):* ${videoInProgress} dates`);
    if (videoEditingPending > 0) lines.push(`• ⏳ *Editing Pending:* ${videoEditingPending} dates`);
    lines.push('');

    lines.push('📷 *GOOGLE DRIVE PHOTO PIPELINE:*');
    lines.push(`• ☁️ *Uploaded to Drive:* ${photoUploaded} of ${total} dates`);
    if (photoGiven > 0) lines.push(`• 👤 *With Video Lead (Murtaza):* ${photoGiven} dates`);
    if (photoEdited > 0) lines.push(`• 🎨 *In Photo Grading:* ${photoEdited} dates`);
    lines.push('');

    lines.push('📦 *SYNCHRONIZED DELIVERABLE MATRIX (BY DATE FOLDER):*');
    lines.push('_Photos are paired with video releases; each scheduled date folder holds both deliverables._');
    safarTasks.forEach((t, idx) => {
      const isVidDone = t.stage === 'uploaded' || t.stage === 'jameya' || (t.stage as any) === 'upload' || (t.stage as any) === 'completed';
      const isPhotoDone = t.photoStage === 'uploaded' || t.photoUploaded;
      const vidTag = isVidDone ? '🎬 Video: Uploaded' : t.stage === 'upload_pending' ? '🎬 Video: Upload Pending' : t.stage === 'editing' ? '🎬 Video: In Progress' : '🎬 Video: Editing Pending';
      const photoTag = isPhotoDone ? '📷 Drive: Uploaded' : t.photoStage === 'given_to_murtaza' ? '📷 Drive: With Lead' : t.photoStage === 'edited' ? '📷 Drive: Grading' : '📷 Drive: Pending';
      const icon = (isVidDone && isPhotoDone) ? '✅' : isVidDone ? '🎬' : '⏳';
      const rawFolder = t.dateFolder || (t as any).folder || (t as any).name || (t as any).folderName || `Date ${idx + 1}`;
      lines.push(`${icon} *${rawFolder}*`);
      lines.push(`   └ [${vidTag}] · [${photoTag}]`);
    });

    lines.push('══════════════════════════════════');
    lines.push(`🌐 *Interactive Briefing:* ${publicOrigin}/briefing?safar=${encodeURIComponent(safarName)}`);
    lines.push(`💻 *Live Workstation Kanban:* ${publicOrigin}/kanban?safar=${encodeURIComponent(safarName)}`);
    lines.push('_Automated Production Telemetry · One Tap Studio_');

    return lines.join('\n');
  };

  const messageText = generateFormattedMessage();

  // Draw the Infographic Image on HTML5 Canvas (White Mode by default or Dark Mode)
  const renderInfographicImage = (theme: 'white' | 'dark' = imageTheme) => {
    setImageGenerating(true);
    try {
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;

      const width = 1200;
      // Calculate dynamic height based on dates list length (unified common column rows)
      const datesCount = safarTasks.length;
      const height = Math.max(920, 520 + datesCount * 44 + 70);

      canvas.width = width * 2; // 2x Retina scale
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setImageGenerating(false);
        return;
      }

    ctx.scale(2, 2);
    const isLight = theme === 'white';

    // 1. Background
    if (isLight) {
      // Crisp White Canvas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Top Header Gradient Wash
      const topGrad = ctx.createLinearGradient(0, 0, width, 260);
      topGrad.addColorStop(0, '#f8fafc');
      topGrad.addColorStop(1, '#ffffff');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, width, 260);

      // Soft glow
      const glow1 = ctx.createRadialGradient(200, 150, 10, 200, 150, 480);
      glow1.addColorStop(0, is100Done ? 'rgba(16, 185, 129, 0.08)' : 'rgba(79, 70, 229, 0.06)');
      glow1.addColorStop(1, 'transparent');
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, width, height);

      // Outer clean border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);
    } else {
      // Sleek Dark Canvas
      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, '#090d16');
      bgGradient.addColorStop(0.5, '#0f172a');
      bgGradient.addColorStop(1, '#0b0f19');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      const glow1 = ctx.createRadialGradient(200, 150, 10, 200, 150, 500);
      glow1.addColorStop(0, is100Done ? 'rgba(16, 185, 129, 0.12)' : 'rgba(79, 70, 229, 0.15)');
      glow1.addColorStop(1, 'transparent');
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, width, height);

      const glow2 = ctx.createRadialGradient(1000, 400, 10, 1000, 400, 450);
      glow2.addColorStop(0, 'rgba(6, 182, 212, 0.08)');
      glow2.addColorStop(1, 'transparent');
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, width - 2, height - 2);
    }

    // 2. Top Header Bar
    ctx.fillStyle = '#4f46e5';
    // Logo square
    ctx.beginPath();
    drawRoundRect(ctx, 40, 40, 42, 42, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('1T', 48, 69);

    // Studio Name
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.fillText('ONE TAP STUDIO', 96, 58);

    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#4f46e5' : '#818cf8';
    ctx.fillText('SAFAR MEDIA WORKSTATION · PRODUCTION TELEMETRY', 96, 74);

    // Timestamp & Verified Badge right-aligned
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    const dateStr = `Live Snapshot · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    const textWidth = ctx.measureText(dateStr).width;
    ctx.fillText(dateStr, width - 40 - textWidth, 65);

    // Divider line
    ctx.strokeStyle = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(40, 100);
    ctx.lineTo(width - 40, 100);
    ctx.stroke();

    // 3. Campaign Hero Banner Card
    ctx.fillStyle = isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    drawRoundRect(ctx, 40, 120, width - 80, 140, 16);
    ctx.fill();
    ctx.strokeStyle = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    // Campaign Eyebrow
    ctx.fillStyle = is100Done ? (isLight ? '#059669' : '#10b981') : (isLight ? '#4f46e5' : '#818cf8');
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(is100Done ? '✓ PRODUCTION COMPLETED' : '📍 ACTIVE PRODUCTION CAMPAIGN', 64, 152);

    // Campaign Title
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    ctx.fillText(safarName, 64, 192);

    // Era & dates subtext
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Hijri Era: ${safarYear} H · ${total} Scheduled Date Deliverables · Video & Photo Workstation`, 64, 222);

    // Large Percentage Badge on the Right
    const badgeX = width - 260;
    const badgeY = 140;
    const badgeW = 200;
    const badgeH = 100;

    ctx.fillStyle = is100Done
      ? (isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)')
      : (isLight ? '#eef2ff' : 'rgba(79, 70, 229, 0.15)');
    ctx.beginPath();
    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.strokeStyle = is100Done ? '#10b981' : '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = is100Done
      ? (isLight ? '#059669' : '#34d399')
      : (isLight ? '#4338ca' : '#818cf8');
    ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(is100Done ? '100%' : `${pct}%`, badgeX + badgeW / 2, badgeY + 48);

    ctx.fillStyle = is100Done
      ? (isLight ? '#047857' : '#ffffff')
      : (isLight ? '#3730a3' : '#ffffff');
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(is100Done ? '🏆 100% DONE' : 'DELIVERED', badgeX + badgeW / 2, badgeY + 70);

    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText(is100Done ? 'All Dates Uploaded' : `${delivered} of ${total} Uploaded`, badgeX + badgeW / 2, badgeY + 86);
    ctx.textAlign = 'left';

    // 4. Multi-color Pipeline Stage Progress Bar
    const barX = 40;
    const barY = 280;
    const barW = width - 80;
    const barH = 12;

    ctx.fillStyle = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    drawRoundRect(ctx, barX, barY, barW, barH, 6);
    ctx.fill();

    // Segments
    let curX = barX;
    const drawSegment = (count: number, color: string) => {
      if (count <= 0) return;
      const segW = (count / total) * barW;
      ctx.fillStyle = color;
      ctx.beginPath();
      drawRoundRect(ctx, curX, barY, segW, barH, 4);
      ctx.fill();
      curX += segW;
    };

    drawSegment(videoJameya, '#047857'); // AlJamea
    drawSegment(videoUploaded, '#10b981'); // Uploaded
    drawSegment(videoUploadPending, '#06b6d4'); // Upload Pending
    drawSegment(videoInProgress, '#3b82f6'); // In Progress
    drawSegment(videoEditingPending, '#f59e0b'); // Editing Pending

    // 5. Unified Synchronized Deliverables Panel (Full width = width - 80 = 1120)
    const cardX = 40;
    const cardY = 310;
    const cardW = width - 80;
    const cardH = 130;

    ctx.fillStyle = isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.fillText('📦 Synchronized Media Pipeline (Video Deliverables & Google Drive Photos)', cardX + 24, cardY + 28);

    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.fillText(`Photos are paired with video releases · ${total} Total Scheduled Deliverables (${total} Video Folders = ${total} Photo Folders)`, cardX + 24, cardY + 48);

    // Summary Metric Badges inside Card 5
    const metricW = 230;
    const metricH = 46;
    const mY = cardY + 64;

    // Metric 1: Video Deliverables
    const m1X = cardX + 24;
    ctx.fillStyle = isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.08)';
    ctx.beginPath();
    drawRoundRect(ctx, m1X, mY, metricW, metricH, 8);
    ctx.fill();
    ctx.strokeStyle = isLight ? '#bbf7d0' : 'rgba(16, 185, 129, 0.2)';
    ctx.stroke();
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#15803d' : '#34d399';
    ctx.fillText('🎬 VIDEO DELIVERABLES', m1X + 12, mY + 16);
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.fillText(`${videoUploaded + videoJameya} / ${total} Uploaded (${pct}%)`, m1X + 12, mY + 35);

    // Metric 2: Drive Photos
    const m2X = m1X + metricW + 16;
    ctx.fillStyle = isLight ? '#eff6ff' : 'rgba(59, 130, 246, 0.08)';
    ctx.beginPath();
    drawRoundRect(ctx, m2X, mY, metricW, metricH, 8);
    ctx.fill();
    ctx.strokeStyle = isLight ? '#bfdbfe' : 'rgba(59, 130, 246, 0.2)';
    ctx.stroke();
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#1d4ed8' : '#60a5fa';
    ctx.fillText('📷 PHOTOS IN DRIVE', m2X + 12, mY + 16);
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.fillText(`${photoUploaded} / ${total} Synced (${total > 0 ? Math.round((photoUploaded / total) * 100) : 0}%)`, m2X + 12, mY + 35);

    // Metric 3: Fully Synced
    const bothUploadedCount = safarTasks.filter(t => (t.stage === 'uploaded' || t.stage === 'jameya' || (t.stage as any) === 'upload' || (t.stage as any) === 'completed') && (t.photoStage === 'uploaded' || t.photoUploaded)).length;
    const m3X = m2X + metricW + 16;
    ctx.fillStyle = isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.12)';
    ctx.beginPath();
    drawRoundRect(ctx, m3X, mY, metricW, metricH, 8);
    ctx.fill();
    ctx.strokeStyle = isLight ? '#a7f3d0' : 'rgba(16, 185, 129, 0.3)';
    ctx.stroke();
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#047857' : '#10b981';
    ctx.fillText('🏆 FULLY SYNCED DATES', m3X + 12, mY + 16);
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.fillText(`${bothUploadedCount} of ${total} Complete`, m3X + 12, mY + 35);

    // Metric 4: Stage Breakdown Pills on the right
    const m4X = m3X + metricW + 20;
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.fillText('PIPELINE BREAKDOWN:', m4X, mY + 14);

    const chips = [
      `${videoUploaded + videoJameya} Uploaded`,
      `${videoUploadPending} Render Pending`,
      `${videoInProgress} In Grading`
    ];
    let chipX = m4X;
    let chipY = mY + 22;
    chips.forEach(c => {
      ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
      const cW = ctx.measureText(c).width + 12;
      ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      drawRoundRect(ctx, chipX, chipY, cW, 18, 4);
      ctx.fill();
      ctx.fillStyle = isLight ? '#475569' : '#cbd5e1';
      ctx.fillText(c, chipX + 6, chipY + 13);
      chipX += cW + 6;
    });

    // 6. Common Column Date Folders Status Matrix
    const listY = 465;
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.fillText(`Scheduled Deliverable Folders (${safarTasks.length} Common Video & Photo Dates)`, 40, listY);

    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Each scheduled date folder contains paired Video Deliverable and Google Drive Photo Deliverable', 40, listY + 18);

    // Table Header Row
    const tableHeaderY = listY + 30;
    const tableW = width - 80;
    ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    drawRoundRect(ctx, 40, tableHeaderY, tableW, 28, 6);
    ctx.fill();
    ctx.font = 'bold 10.5px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
    ctx.fillText('DATE DELIVERABLE FOLDER', 56, tableHeaderY + 18);
    ctx.fillText('🎬 VIDEO DELIVERABLE', 450, tableHeaderY + 18);
    ctx.fillText('📷 GOOGLE DRIVE PHOTOS', 720, tableHeaderY + 18);
    ctx.fillText('DELIVERY STATE', 960, tableHeaderY + 18);

    const rowStartY = tableHeaderY + 34;
    const rowH = 36;
    const rowGap = 6;

    safarTasks.forEach((task, idx) => {
      const rX = 40;
      const rY = rowStartY + idx * (rowH + rowGap);

      const isVideoDelivered = task.stage === 'uploaded' || task.stage === 'jameya' || (task.stage as any) === 'upload' || (task.stage as any) === 'completed';
      const isPhotoDelivered = task.photoStage === 'uploaded' || task.photoUploaded;
      const isDateAllDone = isVideoDelivered && isPhotoDelivered;

      // Item Box
      ctx.fillStyle = isDateAllDone
        ? (isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.08)')
        : isVideoDelivered
        ? (isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)')
        : (isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)');
      ctx.beginPath();
      drawRoundRect(ctx, rX, rY, tableW, rowH, 8);
      ctx.fill();
      ctx.strokeStyle = isDateAllDone
        ? (isLight ? '#bbf7d0' : 'rgba(16, 185, 129, 0.25)')
        : (isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.06)');
      ctx.stroke();

      // Dot
      ctx.fillStyle = isDateAllDone
        ? '#10b981'
        : isVideoDelivered
        ? '#3b82f6'
        : task.stage === 'upload_pending'
        ? '#06b6d4'
        : '#f59e0b';
      ctx.beginPath();
      ctx.arc(rX + 16, rY + rowH / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Folder Name
      ctx.fillStyle = isDateAllDone ? (isLight ? '#065f46' : '#ffffff') : (isLight ? '#0f172a' : '#ffffff');
      ctx.font = 'bold 12.5px system-ui, -apple-system, sans-serif';
      const rawFolder = task.dateFolder || (task as any).folder || (task as any).name || (task as any).folderName || `Date ${idx + 1}`;
      const folderName = rawFolder.length > 44 ? rawFolder.slice(0, 42) + '…' : rawFolder;
      ctx.fillText(folderName, rX + 28, rY + rowH / 2 + 4);

      // Col 2: Video Status Pill (x = 450)
      const vText = task.stage === 'jameya'
        ? '🏛️ AlJamea Done'
        : isVideoDelivered
        ? '✓ Video Uploaded'
        : task.stage === 'upload_pending'
        ? '📤 Upload Pending'
        : task.stage === 'editing'
        ? '🎞️ In Progress'
        : '⏳ Editing Pending';
      const vBg = isVideoDelivered
        ? (isLight ? '#dcfce7' : 'rgba(16, 185, 129, 0.15)')
        : task.stage === 'upload_pending'
        ? (isLight ? '#cffafe' : 'rgba(6, 182, 212, 0.15)')
        : task.stage === 'editing'
        ? (isLight ? '#dbeafe' : 'rgba(59, 130, 246, 0.15)')
        : (isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.15)');
      const vColor = isVideoDelivered
        ? (isLight ? '#15803d' : '#34d399')
        : task.stage === 'upload_pending'
        ? (isLight ? '#0891b2' : '#22d3ee')
        : task.stage === 'editing'
        ? (isLight ? '#1d4ed8' : '#60a5fa')
        : (isLight ? '#b45309' : '#fbbf24');
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      const vW = ctx.measureText(vText).width + 16;
      ctx.fillStyle = vBg;
      ctx.beginPath();
      drawRoundRect(ctx, 450, rY + 8, vW, 20, 5);
      ctx.fill();
      ctx.fillStyle = vColor;
      ctx.fillText(vText, 458, rY + 22);

      // Col 3: Photo Status Pill (x = 720)
      const pText = isPhotoDelivered
        ? '☁️ In Drive (Uploaded)'
        : task.photoStage === 'given_to_murtaza'
        ? '👤 With Murtaza (Lead)'
        : task.photoStage === 'edited'
        ? '🎨 In Photo Grading'
        : '⏳ Photo Sync Pending';
      const pBg = isPhotoDelivered
        ? (isLight ? '#dcfce7' : 'rgba(16, 185, 129, 0.15)')
        : task.photoStage === 'given_to_murtaza'
        ? (isLight ? '#dbeafe' : 'rgba(59, 130, 246, 0.15)')
        : task.photoStage === 'edited'
        ? (isLight ? '#f3e8ff' : 'rgba(168, 85, 247, 0.15)')
        : (isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)');
      const pColor = isPhotoDelivered
        ? (isLight ? '#15803d' : '#34d399')
        : task.photoStage === 'given_to_murtaza'
        ? (isLight ? '#1d4ed8' : '#60a5fa')
        : task.photoStage === 'edited'
        ? (isLight ? '#7e22ce' : '#c084fc')
        : (isLight ? '#64748b' : '#94a3b8');
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      const pW = ctx.measureText(pText).width + 16;
      ctx.fillStyle = pBg;
      ctx.beginPath();
      drawRoundRect(ctx, 720, rY + 8, pW, 20, 5);
      ctx.fill();
      ctx.fillStyle = pColor;
      ctx.fillText(pText, 728, rY + 22);

      // Col 4: Overall Delivery State (x = 960)
      const dText = isDateAllDone
        ? '🏆 100% DONE'
        : isVideoDelivered
        ? '🎬 VIDEO READY'
        : '⏳ IN PROGRESS';
      const dBg = isDateAllDone
        ? (isLight ? '#059669' : '#10b981')
        : isVideoDelivered
        ? (isLight ? '#3b82f6' : '#2563eb')
        : (isLight ? '#f59e0b' : '#d97706');
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      const dW = ctx.measureText(dText).width + 16;
      ctx.fillStyle = dBg;
      ctx.beginPath();
      drawRoundRect(ctx, 960, rY + 8, dW, 20, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(dText, 968, rY + 22);
    });

    // 7. Footer Watermark
    const footerY = height - 40;
    ctx.strokeStyle = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(40, footerY - 15);
    ctx.lineTo(width - 40, footerY - 15);
    ctx.stroke();

    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Live Interactive Telemetry: ${publicOrigin}/briefing?safar=${encodeURIComponent(safarName)}`, 40, footerY + 8);

    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isLight ? '#4f46e5' : '#818cf8';
    const verifiedText = '✓ Verified Production Platform by One Tap Studio';
    const vWidth = ctx.measureText(verifiedText).width;
    ctx.fillText(verifiedText, width - 40 - vWidth, footerY + 8);

    // Export to Blob and Data URL
    canvas.toBlob(blob => {
      if (blob) {
        setImageBlob(blob);
        const url = URL.createObjectURL(blob);
        setGeneratedImageUrl(url);
      }
      setImageGenerating(false);
    }, 'image/png');
  } catch (err) {
    console.error('Failed to render Infographic image on canvas:', err);
    setImageGenerating(false);
  }
};

  useEffect(() => {
    setGeneratedImageUrl(null);
    setImageBlob(null);
  }, [safarName]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      if (initialTab === 'image') {
        setTimeout(() => renderInfographicImage(imageTheme), 50);
      }
    }
  }, [initialTab, isOpen, safarName]);

  useEffect(() => {
    if (isOpen && activeTab === 'image' && !generatedImageUrl) {
      renderInfographicImage(imageTheme);
    }
  }, [isOpen, activeTab, safarName, safarTasks.length, imageTheme]);

  if (!isOpen) return null;

  // Actions
  const handleCopyText = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(messageText);
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
      }
    } catch {}
  };

  const handleCopyImage = async () => {
    try {
      if (imageBlob && typeof ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({ 'image/png': imageBlob });
        await navigator.clipboard.write([item]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2000);
      } else {
        handleDownloadImage();
      }
    } catch (e) {
      handleDownloadImage();
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImageUrl) return;
    const a = document.createElement('a');
    a.href = generatedImageUrl;
    a.download = `OneTap-${safarName.replace(/\s+/g, '_')}-Briefing.png`;
    a.click();
  };

  const handleShareImageNative = async () => {
    if (!imageBlob) return;
    try {
      const file = new File([imageBlob], `OneTap-${safarName.replace(/\s+/g, '_')}-Status.png`, {
        type: 'image/png'
      });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `One Tap Status · ${safarName}`,
          text: `📢 *${safarName}* — ${is100Done ? '100% Done' : `${pct}% Delivered`} Production Briefing\n${publicOrigin}/briefing?safar=${encodeURIComponent(safarName)}`
        });
        return;
      }
    } catch {}
    // Fallback: download image and open WhatsApp with link
    handleDownloadImage();
    handleSendWhatsApp();
  };

  const handleSendWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
    if (onDirectShareWhatsApp) onDirectShareWhatsApp(messageText);
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-modal-title"
      className="whatsapp-briefing-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="whatsapp-briefing-modal-container"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fade-scale 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Mobile Drag Indicator Pill */}
        <div className="modal-mobile-drag-handle" aria-hidden="true" />

        {/* Modal Header */}
        <div
          className="whatsapp-briefing-modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#25d366',
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 10px rgba(37, 211, 102, 0.3)'
              }}
            >
              <MessageCircle size={20} />
            </div>
            <div>
              <h2
                id="briefing-modal-title"
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                WhatsApp Production Briefing
                {is100Done && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #a7f3d0',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🏆 100% DONE
                  </span>
                )}
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {safarName} · {delivered}/{total} Dates Uploaded ({pct}%)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Choose Format: Message vs Image */}
        <div
          className="whatsapp-briefing-tab-selector"
          style={{
            padding: '14px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('msg')}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: activeTab === 'msg' ? '2px solid #25d366' : '1.5px solid #e2e8f0',
              backgroundColor: activeTab === 'msg' ? '#ffffff' : '#f1f5f9',
              boxShadow: activeTab === 'msg' ? '0 4px 12px rgba(37, 211, 102, 0.15)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: activeTab === 'msg' ? '#dcfce7' : '#e2e8f0',
                color: activeTab === 'msg' ? '#15803d' : '#64748b',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              <MessageCircle size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '13px',
                  color: activeTab === 'msg' ? '#0f172a' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>💬 WhatsApp Message</span>
                {activeTab === 'msg' && (
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#25d366', color: '#fff', fontWeight: 800 }}>ACTIVE</span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                Formatted text with date checklist, emojis & link
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('image');
              if (!generatedImageUrl) renderInfographicImage();
            }}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: activeTab === 'image' ? '2px solid #4f46e5' : '1.5px solid #e2e8f0',
              backgroundColor: activeTab === 'image' ? '#ffffff' : '#f1f5f9',
              boxShadow: activeTab === 'image' ? '0 4px 12px rgba(79, 70, 229, 0.15)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: activeTab === 'image' ? '#e0e7ff' : '#e2e8f0',
                color: activeTab === 'image' ? '#4338ca' : '#64748b',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              <ImageIcon size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '13px',
                  color: activeTab === 'image' ? '#0f172a' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🖼️ Infographic Card</span>
                {activeTab === 'image' && (
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#4f46e5', color: '#fff', fontWeight: 800 }}>ACTIVE</span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                1200px Retina studio image card with date matrix
              </div>
            </div>
          </button>
        </div>

        {/* Modal Body */}
        <div className="whatsapp-briefing-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'msg' ? (
            <div>
              {/* 100% Done Alert if all dates uploaded */}
              {is100Done && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #6ee7b7',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#065f46'
                  }}
                >
                  <Award size={20} color="#059669" />
                  <div>
                    <strong style={{ fontSize: '13.5px', display: 'block' }}>
                      Milestone Reached: 100% Done!
                    </strong>
                    <span style={{ fontSize: '12px', color: '#047857' }}>
                      All {total} scheduled dates have been uploaded and finalized. Ready to dispatch executive completion briefing.
                    </span>
                  </div>
                </div>
              )}

              {/* Chat-style Preview Box */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: '12.5px',
                  lineHeight: '1.6',
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '340px',
                  overflowY: 'auto',
                  userSelect: 'text'
                }}
              >
                {messageText}
              </div>
            </div>
          ) : (
            <div>
              {/* Infographic Image Appearance Switcher */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  backgroundColor: '#f8fafc',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block' }}>
                    Infographic Card Style
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {imageTheme === 'white' ? '☀️ Clean Executive White Document (WhatsApp Recommended)' : '🌙 Sleek Night Workstation Dark Mode'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    padding: '3px',
                    borderRadius: '9px',
                    backgroundColor: '#e2e8f0',
                    gap: '4px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setImageTheme('white');
                      renderInfographicImage('white');
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '7px',
                      border: 'none',
                      backgroundColor: imageTheme === 'white' ? '#ffffff' : 'transparent',
                      color: imageTheme === 'white' ? '#0f172a' : '#64748b',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      boxShadow: imageTheme === 'white' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>☀️ White Mode</span>
                    {imageTheme === 'white' && (
                      <span style={{ fontSize: '9px', background: '#22c55e', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>ACTIVE</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImageTheme('dark');
                      renderInfographicImage('dark');
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '7px',
                      border: 'none',
                      backgroundColor: imageTheme === 'dark' ? '#0f172a' : 'transparent',
                      color: imageTheme === 'dark' ? '#ffffff' : '#64748b',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      boxShadow: imageTheme === 'dark' ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🌙 Dark Mode</span>
                    {imageTheme === 'dark' && (
                      <span style={{ fontSize: '9px', background: '#6366f1', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>ACTIVE</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Infographic Image Generator Preview Container */}
              <div
                style={{
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: imageTheme === 'white' ? '1.5px solid #cbd5e1' : '1px solid #1e293b',
                  backgroundColor: imageTheme === 'white' ? '#ffffff' : '#090d16',
                  boxShadow: imageTheme === 'white' ? '0 6px 24px -4px rgba(15, 23, 42, 0.08)' : '0 6px 24px -4px rgba(0, 0, 0, 0.4)',
                  minHeight: '260px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                {imageGenerating ? (
                  <div style={{ color: imageTheme === 'white' ? '#0f172a' : '#ffffff', textAlign: 'center', padding: '50px 20px' }}>
                    <Sparkles size={28} className="spinning" style={{ margin: '0 auto 12px', color: '#4f46e5' }} />
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                      Rendering High-Resolution Studio Infographic in {imageTheme === 'white' ? 'White' : 'Dark'} Mode…
                    </p>
                    <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      Composing pipeline stats & date folder checklist matrix
                    </span>
                  </div>
                ) : generatedImageUrl ? (
                  <img
                    src={generatedImageUrl}
                    alt={`${safarName} Production Briefing (${imageTheme} mode)`}
                    style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '540px', objectFit: 'contain' }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => renderInfographicImage(imageTheme)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      background: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Generate Visual Status Card
                  </button>
                )}
              </div>

              <p style={{ fontSize: '11.5px', color: '#64748b', marginTop: '12px', textAlign: 'center' }}>
                📸 High-res 2X status infographic card · Ready to copy or send directly via WhatsApp.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div
          className="whatsapp-briefing-modal-footer"
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          {activeTab === 'msg' ? (
            <>
              <button
                type="button"
                onClick={handleCopyText}
                style={{
                  padding: '9px 16px',
                  borderRadius: '9px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {copiedText ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                <span>{copiedText ? 'Copied to Clipboard!' : 'Copy Text'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendWhatsApp}
                style={{
                  padding: '10px 20px',
                  borderRadius: '9px',
                  backgroundColor: '#25d366',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)'
                }}
              >
                <MessageCircle size={17} />
                <span>Open in WhatsApp & Send</span>
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={!generatedImageUrl || imageGenerating}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '9px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {copiedImage ? <Check size={15} color="#059669" /> : <Copy size={15} />}
                  <span>{copiedImage ? 'Image Copied!' : 'Copy Image'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={!generatedImageUrl || imageGenerating}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '9px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={15} />
                  <span>Download PNG</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleShareImageNative}
                disabled={!generatedImageUrl || imageGenerating}
                style={{
                  padding: '10px 18px',
                  borderRadius: '9px',
                  backgroundColor: '#25d366',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)'
                }}
              >
                <Share2 size={16} />
                <span>Share Image on WhatsApp</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
