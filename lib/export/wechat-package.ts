import { wechatCoverFilename } from "@/lib/wechat-cover";

export interface WechatPackageInput {
  baseName: string;
  wideCover: Blob;
  squareCover: Blob;
  articleHtml?: string;
}

/** 把公众号文章与两种封面收进一个可交付、可归档的 ZIP。 */
export async function createWechatPackage({
  baseName,
  wideCover,
  squareCover,
  articleHtml,
}: WechatPackageInput): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file(wechatCoverFilename(baseName, "wide"), new Uint8Array(await wideCover.arrayBuffer()));
  zip.file(
    wechatCoverFilename(baseName, "square"),
    new Uint8Array(await squareCover.arrayBuffer()),
  );
  if (articleHtml) zip.file(`${baseName}-wechat.html`, articleHtml);
  return zip.generateAsync({
    type: "blob",
    compression: "STORE",
    mimeType: "application/zip",
  });
}
