"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Download,
  Images,
  Layers3,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/common/color-picker";
import { useT } from "@/components/providers/prefs-provider";
import { useStyles } from "@/components/providers/style-provider";
import { useUserProfile } from "@/components/providers/user-profile-provider";
import { Button } from "@/components/ui/button";
import { Field, Label, SliderField, Switch } from "@/components/ui/misc";
import { UserAvatar } from "@/components/ui/user-avatar";
import { WechatCoverCropDialog } from "@/components/workbench/wechat-cover-crop-dialog";
import { renderPageToBlob } from "@/lib/export/png";
import { downloadBlob } from "@/lib/file";
import {
  WECHAT_COVER_FORMATS,
  wechatCoverFilename,
  type WechatCover,
  type WechatCoverFormat,
} from "@/lib/wechat-cover";
import { cn } from "@/lib/utils";

const MAX_COVER_SOURCE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_COVER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function CoverArtwork({
  cover,
  format,
  title,
  avatar,
  profileName,
  showSafeArea = false,
  artworkRef,
}: {
  cover: WechatCover;
  format: WechatCoverFormat;
  title: string;
  avatar: string;
  profileName: string;
  showSafeArea?: boolean;
  artworkRef?: React.Ref<HTMLDivElement>;
}) {
  const size = WECHAT_COVER_FORMATS[format];
  const image = format === "wide" ? cover.wideImage : cover.squareImage;
  const padding = format === "wide" ? 54 : 42;
  const titleSize = format === "wide" ? 50 : 44;

  return (
    <div
      ref={artworkRef}
      data-wechat-cover-artwork={format}
      className="relative isolate overflow-hidden"
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: cover.backgroundColor,
        color: cover.textColor,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <span
            className="absolute -right-24 -top-32 size-96 rounded-full border-[58px]"
            style={{ borderColor: cover.textColor, opacity: 0.08 }}
          />
          <span
            className="absolute -bottom-36 -left-20 size-80 rounded-full"
            style={{ backgroundColor: cover.textColor, opacity: 0.06 }}
          />
        </>
      )}
      <span
        className="absolute inset-0"
        style={{
          backgroundColor: cover.overlayColor,
          opacity: image ? cover.overlayOpacity : cover.overlayOpacity * 0.4,
        }}
      />

      {showSafeArea && format === "wide" ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-1/2 border-x-2 border-dashed border-white/60 bg-white/[0.03]"
          style={{ width: size.height, transform: "translateX(-50%)" }}
        />
      ) : null}

      <div
        className={cn(
          "relative z-10 flex size-full flex-col gap-5",
          cover.position === "top" && "justify-start",
          cover.position === "center" && "justify-center",
          cover.position === "bottom" && "justify-end",
          cover.align === "center" && "items-center text-center",
          cover.align === "left" && "items-start text-left",
          cover.align === "right" && "items-end text-right",
        )}
        style={{ padding }}
      >
        <div style={{ maxWidth: format === "wide" ? 690 : 410 }}>
          {cover.subtitle ? (
            <p
              className="mb-3 font-semibold uppercase tracking-[0.22em]"
              style={{ fontSize: format === "wide" ? 17 : 15, opacity: 0.84 }}
            >
              {cover.subtitle}
            </p>
          ) : null}
          <h2
            className="whitespace-pre-wrap font-black tracking-[-0.045em] [overflow-wrap:anywhere]"
            style={{ fontSize: titleSize, lineHeight: 1.12 }}
          >
            {title || " "}
          </h2>
        </div>

        {cover.showProfile ? (
          <div
            className={cn(
              "flex items-center gap-3",
              cover.align === "center" && "justify-center",
              cover.align === "right" && "justify-end",
            )}
          >
            <UserAvatar
              src={avatar}
              name={profileName}
              style={{ width: format === "wide" ? 34 : 32, height: format === "wide" ? 34 : 32 }}
            />
            <span className="font-semibold tracking-wide" style={{ fontSize: 16 }}>
              {profileName}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScaledCoverPreview({
  cover,
  format,
  title,
  avatar,
  profileName,
  showSafeArea,
}: {
  cover: WechatCover;
  format: WechatCoverFormat;
  title: string;
  avatar: string;
  profileName: string;
  showSafeArea: boolean;
}) {
  const size = WECHAT_COVER_FORMATS[format];
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(1);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setWidth(Math.max(1, host.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const scale = width / size.width;
  return (
    <div
      ref={hostRef}
      className="relative w-full overflow-hidden rounded-md bg-muted"
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <CoverArtwork
          cover={cover}
          format={format}
          title={title}
          avatar={avatar}
          profileName={profileName}
          showSafeArea={showSafeArea}
        />
      </div>
    </div>
  );
}

function CoverPreviewCard({
  format,
  cover,
  title,
  avatar,
  profileName,
  showSafeArea,
  onUpload,
  onClear,
  onDownload,
}: {
  format: WechatCoverFormat;
  cover: WechatCover;
  title: string;
  avatar: string;
  profileName: string;
  showSafeArea: boolean;
  onUpload: (format: WechatCoverFormat) => void;
  onClear: (format: WechatCoverFormat) => void;
  onDownload: (format: WechatCoverFormat) => void;
}) {
  const t = useT();
  const size = WECHAT_COVER_FORMATS[format];
  const hasImage = Boolean(format === "wide" ? cover.wideImage : cover.squareImage);

  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-3 border-b border-dashed px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-semibold">
            {t(format === "wide" ? "wechat.coverWide" : "wechat.coverSquare")}
          </h4>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {size.width} × {size.height}
          </p>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {hasImage ? <Check className="size-3 text-emerald-600" /> : null}
          {t(hasImage ? "wechat.coverImageReady" : "wechat.coverColorOnly")}
        </span>
      </div>

      <div className="bg-muted/20 p-3">
        <ScaledCoverPreview
          cover={cover}
          format={format}
          title={title}
          avatar={avatar}
          profileName={profileName}
          showSafeArea={showSafeArea}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-dashed px-3 py-2.5">
        <Button type="button" variant="outline" size="sm" onClick={() => onUpload(format)}>
          <Upload />
          {hasImage ? t("wechat.coverRecrop") : t("wechat.coverAddImage")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onDownload(format)}>
          <Download />
          {t("common.download")}
        </Button>
        {hasImage ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onClear(format)}>
            <Trash2 />
            {t("common.clear")}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function WechatCoverEditor({
  documentTitle,
  docBaseName,
}: {
  documentTitle: string;
  docBaseName: string;
}) {
  const t = useT();
  const { wechatCover, setWechatCover, resetWechatCover } = useStyles();
  const { profile } = useUserProfile();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const sourceUrlRef = React.useRef("");
  const wideExportRef = React.useRef<HTMLDivElement>(null);
  const squareExportRef = React.useRef<HTMLDivElement>(null);
  const [cropSrc, setCropSrc] = React.useState("");
  const [cropFormat, setCropFormat] = React.useState<WechatCoverFormat>("wide");
  const [safeArea, setSafeArea] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);

  const resolvedTitle = wechatCover.useDocumentTitle
    ? documentTitle || t("wechat.coverTitleFallback")
    : wechatCover.title;

  const setCover = (patch: Partial<WechatCover>) => setWechatCover(patch);

  const closeCrop = React.useCallback(() => {
    setCropSrc("");
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = "";
    }
  }, []);

  React.useEffect(() => closeCrop, [closeCrop]);

  const chooseSource = (format: WechatCoverFormat) => {
    setCropFormat(format);
    inputRef.current?.click();
  };

  const handleSource = (file: File) => {
    if (!ACCEPTED_COVER_TYPES.has(file.type)) {
      toast.error(t("wechat.coverImageTypeError"));
      return;
    }
    if (file.size > MAX_COVER_SOURCE_BYTES) {
      toast.error(t("wechat.coverImageSizeError"));
      return;
    }
    closeCrop();
    const url = URL.createObjectURL(file);
    sourceUrlRef.current = url;
    setCropSrc(url);
  };

  const getExportNode = (format: WechatCoverFormat) =>
    format === "wide" ? wideExportRef.current : squareExportRef.current;

  const renderCover = async (format: WechatCoverFormat) => {
    const node = getExportNode(format);
    if (!node) return null;
    await document.fonts?.ready;
    return renderPageToBlob(node, {
      scale: 1,
      backgroundColor: wechatCover.backgroundColor,
    });
  };

  const downloadOne = async (format: WechatCoverFormat) => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await renderCover(format);
      if (!blob) throw new Error("empty");
      downloadBlob(blob, wechatCoverFilename(docBaseName, format));
      toast.success(t("wechat.coverDownloadDone"));
    } catch {
      toast.error(t("wechat.coverDownloadFailed"));
    } finally {
      setExporting(false);
    }
  };

  const downloadBoth = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const [wide, square] = await Promise.all([renderCover("wide"), renderCover("square")]);
      if (!wide || !square) throw new Error("empty");
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      zip.file(wechatCoverFilename(docBaseName, "wide"), new Uint8Array(await wide.arrayBuffer()));
      zip.file(
        wechatCoverFilename(docBaseName, "square"),
        new Uint8Array(await square.arrayBuffer()),
      );
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "STORE",
        mimeType: "application/zip",
      });
      downloadBlob(blob, `${docBaseName}-wechat-covers.zip`);
      toast.success(t("wechat.coverBothDownloadDone"));
    } catch {
      toast.error(t("wechat.coverDownloadFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Images className="size-4 text-brand-primary" />
            {t("wechat.coverPreviewTitle")}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("wechat.coverPreviewDesc")}
          </p>
        </div>

        <CoverPreviewCard
          format="wide"
          cover={wechatCover}
          title={resolvedTitle}
          avatar={profile.avatar}
          profileName={profile.name}
          showSafeArea={safeArea}
          onUpload={chooseSource}
          onClear={() => setCover({ wideImage: "" })}
          onDownload={(format) => void downloadOne(format)}
        />
        <CoverPreviewCard
          format="square"
          cover={wechatCover}
          title={resolvedTitle}
          avatar={profile.avatar}
          profileName={profile.name}
          showSafeArea={false}
          onUpload={chooseSource}
          onClear={() => setCover({ squareImage: "" })}
          onDownload={(format) => void downloadOne(format)}
        />

        <div className="flex items-center justify-between gap-4 rounded-md border border-dashed px-3 py-2.5">
          <div>
            <Label htmlFor="wechat-cover-safe-area">{t("wechat.coverSafeArea")}</Label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("wechat.coverSafeAreaDesc")}
            </p>
          </div>
          <Switch id="wechat-cover-safe-area" checked={safeArea} onCheckedChange={setSafeArea} />
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={() => void downloadBoth()}
          disabled={exporting}
        >
          <Layers3 />
          {t("wechat.coverDownloadBoth")}
        </Button>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold">{t("wechat.coverContentTitle")}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("wechat.coverContentDesc")}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="wechat-cover-auto-title">{t("wechat.coverAutoTitle")}</Label>
          <Switch
            id="wechat-cover-auto-title"
            checked={wechatCover.useDocumentTitle}
            onCheckedChange={(useDocumentTitle) => setCover({ useDocumentTitle })}
          />
        </div>
        {!wechatCover.useDocumentTitle ? (
          <Field label={t("wechat.coverTitle")} htmlFor="wechat-cover-title">
            <textarea
              id="wechat-cover-title"
              value={wechatCover.title}
              maxLength={120}
              rows={3}
              onChange={(event) => setCover({ title: event.target.value })}
              className="w-full resize-y rounded-md border border-input bg-card/60 px-3 py-2 text-sm"
            />
          </Field>
        ) : null}
        <Field label={t("wechat.coverSubtitle")} htmlFor="wechat-cover-subtitle">
          <input
            id="wechat-cover-subtitle"
            value={wechatCover.subtitle}
            maxLength={160}
            placeholder={t("wechat.coverSubtitlePlaceholder")}
            onChange={(event) => setCover({ subtitle: event.target.value })}
            className="h-9 w-full rounded-md border border-input bg-card/60 px-3 text-sm"
          />
        </Field>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="wechat-cover-profile">{t("wechat.coverShowProfile")}</Label>
          <Switch
            id="wechat-cover-profile"
            checked={wechatCover.showProfile}
            onCheckedChange={(showProfile) => setCover({ showProfile })}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold">{t("wechat.coverStyleTitle")}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("wechat.coverStyleDesc")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorPicker
            label={t("wechat.coverBackground")}
            value={wechatCover.backgroundColor}
            displayValue={wechatCover.backgroundColor}
            onChange={(backgroundColor) => setCover({ backgroundColor })}
          />
          <ColorPicker
            label={t("wechat.coverTextColor")}
            value={wechatCover.textColor}
            displayValue={wechatCover.textColor}
            onChange={(textColor) => setCover({ textColor })}
          />
          <ColorPicker
            label={t("wechat.coverOverlayColor")}
            value={wechatCover.overlayColor}
            displayValue={wechatCover.overlayColor}
            onChange={(overlayColor) => setCover({ overlayColor })}
          />
          <SliderField
            label={t("wechat.coverOverlayOpacity")}
            value={wechatCover.overlayOpacity}
            min={0}
            max={0.85}
            step={0.05}
            onChange={(overlayOpacity) => setCover({ overlayOpacity })}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("wechat.coverAlign")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                aria-pressed={wechatCover.align === align}
                onClick={() => setCover({ align })}
                className={cn(
                  "flex h-9 items-center justify-center gap-2 rounded-md border text-xs transition-colors",
                  wechatCover.align === align
                    ? "border-brand-primary bg-brand-primary/8 text-brand-primary"
                    : "border-border hover:bg-accent",
                )}
              >
                {align === "left" ? <AlignLeft className="size-4" /> : null}
                {align === "center" ? <AlignCenter className="size-4" /> : null}
                {align === "right" ? <AlignRight className="size-4" /> : null}
                {t(
                  align === "left"
                    ? "wechat.alignLeft"
                    : align === "center"
                      ? "wechat.alignCenter"
                      : "wechat.alignRight",
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("wechat.coverPosition")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["top", "center", "bottom"] as const).map((position) => (
              <button
                key={position}
                type="button"
                aria-pressed={wechatCover.position === position}
                onClick={() => setCover({ position })}
                className={cn(
                  "h-9 rounded-md border text-xs transition-colors",
                  wechatCover.position === position
                    ? "border-brand-primary bg-brand-primary/8 text-brand-primary"
                    : "border-border hover:bg-accent",
                )}
              >
                {t(
                  `wechat.coverPosition${position[0].toUpperCase()}${position.slice(1)}` as "wechat.coverPositionTop",
                )}
              </button>
            ))}
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={resetWechatCover}>
          <RotateCcw />
          {t("wechat.coverReset")}
        </Button>
      </section>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleSource(file);
          event.target.value = "";
        }}
      />

      {cropSrc ? (
        <WechatCoverCropDialog
          src={cropSrc}
          open
          initialFormat={cropFormat}
          savedFormats={{
            wide: Boolean(wechatCover.wideImage),
            square: Boolean(wechatCover.squareImage),
          }}
          onOpenChange={(open) => {
            if (!open) closeCrop();
          }}
          onSave={(format, image) =>
            setCover(format === "wide" ? { wideImage: image } : { squareImage: image })
          }
        />
      ) : null}

      <div aria-hidden style={{ position: "fixed", top: 0, left: -100_000, zIndex: -1 }}>
        <CoverArtwork
          cover={wechatCover}
          format="wide"
          title={resolvedTitle}
          avatar={profile.avatar}
          profileName={profile.name}
          artworkRef={wideExportRef}
        />
        <CoverArtwork
          cover={wechatCover}
          format="square"
          title={resolvedTitle}
          avatar={profile.avatar}
          profileName={profile.name}
          artworkRef={squareExportRef}
        />
      </div>
    </div>
  );
}
