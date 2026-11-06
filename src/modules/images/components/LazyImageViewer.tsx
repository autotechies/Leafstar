"use client";

import dynamic from "next/dynamic";

/*
  The viewer's code (about 40 KB) is fetched only when someone first opens a photo,
  so catalog and inventory pages stay light. Always import the viewer from here, never directly.
*/
export const ImageViewer = dynamic(() => import("./ImageViewer"), { ssr: false });
