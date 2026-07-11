declare module "next/dist/lib/metadata/types/metadata-interface.js" {
  export type ResolvingMetadata = Promise<Record<string, unknown>>;
  export type ResolvingViewport = Promise<Record<string, unknown>>;
}

declare module "next/server.js" {
  type NextMiddlewareResponse = Response & {
    cookies: {
      set(name: string, value: string, options?: Record<string, unknown>): void;
    };
  };

  export type NextRequest = Request & {
    nextUrl: URL;
    cookies: {
      getAll(): Array<{ name: string; value: string }>;
      set(name: string, value: string): void;
    };
  };

  export const NextResponse: {
    json: typeof Response.json;
    redirect(input: string | URL, init?: ResponseInit): Response;
    next(init?: ResponseInit & { request?: Request }): NextMiddlewareResponse;
  };
}

declare module "next/server" {
  type NextMiddlewareResponse = Response & {
    cookies: {
      set(name: string, value: string, options?: Record<string, unknown>): void;
    };
  };

  export type NextRequest = Request & {
    nextUrl: URL;
    cookies: {
      getAll(): Array<{ name: string; value: string }>;
      set(name: string, value: string): void;
    };
  };

  export const NextResponse: {
    json: typeof Response.json;
    redirect(input: string | URL, init?: ResponseInit): Response;
    next(init?: ResponseInit & { request?: Request }): NextMiddlewareResponse;
  };
}

declare module "next/types.js" {
  export type ResolvingMetadata = Promise<Record<string, unknown>>;
  export type ResolvingViewport = Promise<Record<string, unknown>>;
}

declare module "next/link" {
  import type { AnchorHTMLAttributes, ReactNode } from "react";

  export default function Link(
    props: AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
      children?: ReactNode;
    }
  ): ReactNode;
}
