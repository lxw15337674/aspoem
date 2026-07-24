"use client";

import { toPng } from "html-to-image";
import {
  CheckIcon,
  ClipboardIcon,
  DownloadIcon,
  PrinterIcon,
  Share2Icon,
} from "lucide-react";
import type { ComponentRef } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ApiPoemFindDetail } from "@/server/api/router/poem";

function TooltipButton({
  children,
  label,
}: {
  children: React.ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function PoemTools({ poem }: { poem: ApiPoemFindDetail }) {
  const shareCardRef = useRef<ComponentRef<"div">>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const plainText = `${poem.paragraphs.join("\n")}\n\n-- 《${poem.title}》${poem.dynasty?.name ?? ""} ${poem.author.name}${poem.translation ? `\n\n【译文】\n${poem.translation}` : ""}`;

  async function copyPoem() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = plainText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Copy failed");
      }
      setCopied(true);
      toast.success("已复制诗词内容");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败，请检查浏览器权限");
    }
  }

  async function createImage() {
    if (!shareCardRef.current) return null;
    setGenerating(true);
    try {
      return await toPng(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: Math.max(2, window.devicePixelRatio),
      });
    } catch {
      toast.error("卡片生成失败，请重试");
      return null;
    } finally {
      setGenerating(false);
    }
  }

  async function downloadImage() {
    const image = await createImage();
    if (!image) return;
    const link = document.createElement("a");
    link.download = `${poem.title}-aspoem.png`;
    link.href = image;
    link.click();
  }

  async function shareImage() {
    const image = await createImage();
    if (!image) return;

    const blob = await fetch(image).then((response) => response.blob());
    const file = new File([blob], `${poem.title}-aspoem.png`, {
      type: "image/png",
    });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `《${poem.title}》` });
      return;
    }
    await downloadImage();
  }

  return (
    <div className="flex items-center gap-1">
      <TooltipButton label={copied ? "已复制" : "复制诗词与译文"}>
        <Button
          aria-label="复制诗词与译文"
          onClick={copyPoem}
          size="icon"
          variant="outline"
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />}
        </Button>
      </TooltipButton>
      <TooltipButton label="打印">
        <Button asChild aria-label="打印" size="icon" variant="outline">
          <a href={`/poems/detail/${poem.slug}/print`} target="_blank">
            <PrinterIcon />
          </a>
        </Button>
      </TooltipButton>
      <Dialog>
        <TooltipButton label="生成分享卡片">
          <DialogTrigger asChild>
            <Button aria-label="生成分享卡片" size="icon" variant="outline">
              <Share2Icon />
            </Button>
          </DialogTrigger>
        </TooltipButton>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>分享卡片</DialogTitle>
            <DialogDescription>《{poem.title}》</DialogDescription>
          </DialogHeader>
          <div
            className="border bg-stone-100 p-7 text-stone-900 dark:bg-stone-900 dark:text-stone-100"
            ref={shareCardRef}
          >
            <p className="text-xs tracking-[0.18em] text-stone-500 dark:text-stone-400">
              ASPOEM
            </p>
            <h2 className="mt-8 text-2xl font-semibold">《{poem.title}》</h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
              {poem.dynasty?.name ?? ""} {poem.author.name}
            </p>
            <div className="my-8 h-px bg-stone-300 dark:bg-stone-700" />
            <p className="whitespace-pre-wrap font-serif text-xl leading-9">
              {poem.paragraphs.join("\n")}
            </p>
            <p className="mt-10 text-right text-xs text-stone-500 dark:text-stone-400">
              aspoem.com
            </p>
          </div>
          <DialogFooter>
            <Button
              disabled={generating}
              onClick={downloadImage}
              variant="outline"
            >
              <DownloadIcon />
              下载 PNG
            </Button>
            <Button disabled={generating} onClick={shareImage}>
              <Share2Icon />
              分享
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
