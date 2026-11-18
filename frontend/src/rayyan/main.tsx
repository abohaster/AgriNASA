import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "../index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { DataModeProvider } from "../context/DataModeContext";
import { ThemeProvider } from "../context/ThemeContext";
import { I18nProvider } from "../i18n/I18nContext";
import { RayyanChatPage } from "./ChatPage";
import { RayyanSettingsPage } from "./SettingsPage";

/**
 * Standalone RAYAN entry used until the navigation patch to `App.tsx` /
 * `SiteHeader.tsx` is approved. Everything it mounts is a new, isolated file.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <I18nProvider>
          <DataModeProvider>
            <Routes>
              <Route path="/rayyan" element={<RayyanChatPage />} />
              <Route path="/rayyan/settings" element={<RayyanSettingsPage />} />
              <Route path="*" element={<Navigate to="/rayyan" replace />} />
            </Routes>
          </DataModeProvider>
        </I18nProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>,
);
