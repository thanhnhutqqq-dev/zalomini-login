import React, { FC, useEffect } from "react";
import HomePage from "../pages/index/index";
import { getSystemInfo } from "zmp-sdk";

export const Layout: FC = () => {
  useEffect(() => {
    if (import.meta.env.DEV) {
      document.body.style.setProperty("--zaui-safe-area-inset-top", "24px");
      return () => {
        document.body.style.removeProperty("--zaui-safe-area-inset-top");
      };
    }
    if (getSystemInfo().platform === "android") {
      const statusBarHeight =
        window.ZaloJavaScriptInterface?.getStatusBarHeight() ?? 0;
      const androidSafeTop = Math.round(
        statusBarHeight / window.devicePixelRatio
      );
      document.body.style.setProperty(
        "--zaui-safe-area-inset-top",
        `${androidSafeTop}px`
      );
      return () => {
        document.body.style.removeProperty("--zaui-safe-area-inset-top");
      };
    }
    return;
  }, []);

  return <HomePage />;
};
