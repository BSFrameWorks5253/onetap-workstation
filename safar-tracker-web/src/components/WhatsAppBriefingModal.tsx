import React, { useState, useEffect, useRef } from 'react';
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
  onDirectShareWhatsApp?: (text: string) => void;
  publicOrigin?: string;
}

export default function WhatsAppBriefingModal({
  isOpen,
  onClose,
  safarName,
  safarYear = '1447',
  tasks,
  onDirectShareWhatsApp,
  publicOrigin = 'https://safar-tracker-web.vercel.app'
}: WhatsAppBriefingModalProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<'msg' | 'image'>('msg');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filter tasks for this safar
  const safarTasks = tasks.filter(t => t.safarName === safarName);
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
    .map(t => t.dateFolder);
  const pendingDates = safarTasks
    .filter(t => t.stage === 'editing_pending' || t.stage === 'editing' || t.stage === 'upload_pending' || (t.stage as any) === 'rendering')
    .map(t => ({ folder: t.dateFolder, stage: t.stage }));

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

    lines.push('📦 *DELIVERABLE STATUS BREAKDOWN:*');
    if (deliveredDates.length > 0) {
      lines.push(`✅ *Delivered Dates (${deliveredDates.length}):*`);
      deliveredDates.slice(0, 10).forEach(d => lines.push(`   • ${d}`));
      if (deliveredDates.length > 10) lines.push(`   • ... +${deliveredDates.length - 10} more dates`);
    }
    if (pendingDates.length > 0) {
      lines.push(`⏳ *Pending Dates (${pendingDates.length}):*`);
      pendingDates.slice(0, 10).forEach(p => {
        const stageLabel = p.stage === 'upload_pending' ? 'Upload Pending' : p.stage === 'editing' ? 'In Progress' : 'Editing Pending';
        lines.push(`   • ${p.folder} [${stageLabel}]`);
      });
      if (pendingDates.length > 10) lines.push(`   • ... +${pendingDates.length - 10} more dates`);
    }

    lines.push('══════════════════════════════════');
    lines.push(`🌐 *Interactive Briefing:* ${publicOrigin}/briefing?safar=${encodeURIComponent(safarName)}`);
    lines.push(`💻 *Live Workstation Kanban:* ${publicOrigin}/kanban?safar=${encodeURIComponent(safarName)}`);
    lines.push('_Automated Production Telemetry · One Tap Studio_');

    return lines.join('\n');
  };

  const messageText = generateFormattedMessage();

  // Draw the Infographic Image on HTML5 Canvas
  const renderInfographicImage = () => {
    setImageGenerating(true);
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;

    const width = 1200;
    // Calculate dynamic height based on dates list length
    const datesCount = safarTasks.length;
    const height = Math.max(880, 720 + Math.ceil(datesCount / 2) * 36);

    canvas.width = width * 2; // 2x Retina scale
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);

    // 1. Background Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#090d16');
    bgGradient.addColorStop(0.5, '#0f172a');
    bgGradient.addColorStop(1, '#0b0f19');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle background mesh glow
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

    // Outer border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // 2. Top Header Bar
    ctx.fillStyle = '#4f46e5';
    // Logo square
    ctx.beginPath();
    ctx.roundRect(40, 40, 42, 42, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('1T', 48, 69);

    // Studio Name
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ONE TAP STUDIO', 96, 58);

    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#818cf8';
    ctx.fillText('SAFAR MEDIA WORKSTATION · PRODUCTION TELEMETRY', 96, 74);

    // Timestamp & Verified Badge right-aligned
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    const dateStr = `Live Snapshot · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    const textWidth = ctx.measureText(dateStr).width;
    ctx.fillText(dateStr, width - 40 - textWidth, 65);

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(40, 100);
    ctx.lineTo(width - 40, 100);
    ctx.stroke();

    // 3. Campaign Hero Banner Card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.roundRect(40, 120, width - 80, 140, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    // Campaign Eyebrow
    ctx.fillStyle = is100Done ? '#10b981' : '#818cf8';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(is100Done ? '✓ PRODUCTION COMPLETED' : '📍 ACTIVE PRODUCTION CAMPAIGN', 64, 152);

    // Campaign Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    ctx.fillText(safarName, 64, 192);

    // Era & dates subtext
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Hijri Era: ${safarYear} H · ${total} Scheduled Date Deliverables · Video & Photo Workstation`, 64, 222);

    // Large Percentage Badge on the Right
    const badgeX = width - 260;
    const badgeY = 140;
    const badgeW = 200;
    const badgeH = 100;

    ctx.fillStyle = is100Done ? 'rgba(16, 185, 129, 0.15)' : 'rgba(79, 70, 229, 0.15)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.strokeStyle = is100Done ? '#10b981' : '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = is100Done ? '#34d399' : '#818cf8';
    ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(is100Done ? '100%' : `${pct}%`, badgeX + badgeW / 2, badgeY + 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(is100Done ? '100% DONE' : 'DELIVERED', badgeX + badgeW / 2, badgeY + 70);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText(is100Done ? 'All Dates Uploaded' : `${delivered} of ${total} Uploaded`, badgeX + badgeW / 2, badgeY + 86);
    ctx.textAlign = 'left';

    // 4. Multi-color Pipeline Stage Progress Bar
    const barX = 40;
    const barY = 280;
    const barW = width - 80;
    const barH = 12;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();

    // Segments
    let curX = barX;
    const drawSegment = (count: number, color: string) => {
      if (count <= 0) return;
      const segW = (count / total) * barW;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(curX, barY, segW, barH, 4);
      ctx.fill();
      curX += segW;
    };

    drawSegment(videoJameya, '#047857'); // AlJamea
    drawSegment(videoUploaded, '#10b981'); // Uploaded
    drawSegment(videoUploadPending, '#06b6d4'); // Upload Pending
    drawSegment(videoInProgress, '#3b82f6'); // In Progress
    drawSegment(videoEditingPending, '#f59e0b'); // Editing Pending

    // 5. Two Parallel Workflow Stat Cards
    const colW = (width - 100) / 2;
    const cardY = 310;
    const cardH = 140;

    // Card A: Video Pipeline
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.roundRect(40, cardY, colW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🎬 Video Production Pipeline', 60, cardY + 30);

    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Delivered: ${delivered}/${total} dates (${is100Done ? '100% Complete' : `${pct}%`})`, 60, cardY + 52);

    // Chips inside card A
    const vChips = [
      { label: `${videoJameya} AlJamea Done`, color: '#10b981' },
      { label: `${videoUploaded} Uploaded`, color: '#059669' },
      { label: `${videoUploadPending} Upload Pending`, color: '#06b6d4' },
      { label: `${videoInProgress} In Progress`, color: '#3b82f6' },
      { label: `${videoEditingPending} Editing Pending`, color: '#f59e0b' }
    ];

    let chipX = 60;
    let chipY = cardY + 76;
    vChips.forEach(c => {
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const cWidth = ctx.measureText(c.label).width + 16;
      if (chipX + cWidth > 40 + colW - 20) {
        chipX = 60;
        chipY += 28;
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.roundRect(chipX, chipY, cWidth, 22, 6);
      ctx.fill();
      ctx.fillStyle = c.color;
      ctx.fillText(c.label, chipX + 8, chipY + 15);
      chipX += cWidth + 8;
    });

    // Card B: Google Drive Photos
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.roundRect(40 + colW + 20, cardY, colW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('📷 Google Drive Photo Delivery', 40 + colW + 40, cardY + 30);

    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Drive Sync: ${photoUploaded}/${total} Deliverables Uploaded (${total > 0 ? Math.round((photoUploaded / total) * 100) : 0}%)`, 40 + colW + 40, cardY + 52);

    // Chips inside card B
    const pChips = [
      { label: `${photoUploaded} Uploaded to Drive`, color: '#10b981' },
      { label: `${photoGiven} With Murtaza (Lead)`, color: '#60a5fa' },
      { label: `${photoEdited} In Photo Grading`, color: '#a78bfa' }
    ];

    let pChipX = 40 + colW + 40;
    let pChipY = cardY + 76;
    pChips.forEach(c => {
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const cWidth = ctx.measureText(c.label).width + 16;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.roundRect(pChipX, pChipY, cWidth, 22, 6);
      ctx.fill();
      ctx.fillStyle = c.color;
      ctx.fillText(c.label, pChipX + 8, pChipY + 15);
      pChipX += cWidth + 8;
    });

    // 6. Date Folders Status Matrix
    const listY = 475;
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Date Folders Status Matrix (${safarTasks.length} Scheduled Deliverables)`, 40, listY);

    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(is100Done ? '✓ All date folders are delivered and synchronized' : 'Overview of uploaded vs pending dates', 40, listY + 20);

    const rowStartY = listY + 40;
    const rowH = 34;
    const colWidth = (width - 100) / 2;

    safarTasks.forEach((task, idx) => {
      const isColRight = idx % 2 === 1;
      const rowIndex = Math.floor(idx / 2);
      const rX = isColRight ? 40 + colWidth + 20 : 40;
      const rY = rowStartY + rowIndex * (rowH + 8);

      const isDelivered =
        task.stage === 'uploaded' || task.stage === 'jameya' || (task.stage as any) === 'upload' || (task.stage as any) === 'completed';

      // Item Box
      ctx.fillStyle = isDelivered ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.roundRect(rX, rY, colWidth, rowH, 8);
      ctx.fill();
      ctx.strokeStyle = isDelivered ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)';
      ctx.stroke();

      // Dot
      ctx.fillStyle = isDelivered ? '#10b981' : task.stage === 'upload_pending' ? '#06b6d4' : task.stage === 'editing' ? '#3b82f6' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(rX + 16, rY + rowH / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 12px system-ui, -apple-system, sans-serif';
      const folderText = task.dateFolder.length > 36 ? task.dateFolder.slice(0, 34) + '…' : task.dateFolder;
      ctx.fillText(folderText, rX + 28, rY + rowH / 2 + 4);

      // Status Tag
      const tagText = isDelivered ? 'UPLOADED' : task.stage === 'upload_pending' ? 'UPLOAD PEND' : task.stage === 'editing' ? 'IN PROGRESS' : 'PENDING';
      ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
      const tagW = ctx.measureText(tagText).width + 12;
      const tagX = rX + colWidth - tagW - 12;
      const tagY = rY + 7;

      ctx.fillStyle = isDelivered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)';
      ctx.beginPath();
      ctx.roundRect(tagX, tagY, tagW, 20, 4);
      ctx.fill();

      ctx.fillStyle = isDelivered ? '#34d399' : '#fbbf24';
      ctx.fillText(tagText, tagX + 6, tagY + 14);
    });

    // 7. Footer Watermark
    const footerY = height - 40;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(40, footerY - 15);
    ctx.lineTo(width - 40, footerY - 15);
    ctx.stroke();

    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Live Interactive Telemetry: ${publicOrigin}/briefing?safar=${encodeURIComponent(safarName)}`, 40, footerY + 8);

    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#818cf8';
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
  };

  useEffect(() => {
    if (isOpen && activeTab === 'image') {
      renderInfographicImage();
    }
  }, [isOpen, activeTab, safarName, safarTasks.length]);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
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
        {/* Modal Header */}
        <div
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

        {/* Tab Switcher: Message vs Image */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            gap: '8px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('msg')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              border: activeTab === 'msg' ? '1.5px solid #25d366' : '1px solid #e2e8f0',
              backgroundColor: activeTab === 'msg' ? '#f0fdf4' : '#ffffff',
              color: activeTab === 'msg' ? '#15803d' : '#475569',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            <MessageCircle size={16} />
            <span>Format 1: WhatsApp Message (Text)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('image');
              if (!generatedImageUrl) renderInfographicImage();
            }}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              border: activeTab === 'image' ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
              backgroundColor: activeTab === 'image' ? '#eef2ff' : '#ffffff',
              color: activeTab === 'image' ? '#4338ca' : '#475569',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            <ImageIcon size={16} />
            <span>Format 2: Infographic Card (Image)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
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
              {/* Infographic Image Generator Preview */}
              <div
                style={{
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#090d16',
                  minHeight: '260px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                {imageGenerating ? (
                  <div style={{ color: '#ffffff', textAlign: 'center', padding: '40px' }}>
                    <Sparkles size={28} className="spinning" style={{ margin: '0 auto 12px' }} />
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                      Rendering High-Resolution Studio Infographic…
                    </p>
                  </div>
                ) : generatedImageUrl ? (
                  <img
                    src={generatedImageUrl}
                    alt={`${safarName} Production Briefing`}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={renderInfographicImage}
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

              <p style={{ fontSize: '11.5px', color: '#64748b', marginTop: '10px', textAlign: 'center' }}>
                📸 High-res 2X status infographic showing live progress, stage distribution, and date folders breakdown.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div
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
}
