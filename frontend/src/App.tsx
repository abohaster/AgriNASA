import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AnalyticsPage } from "./pages/Analytics";
import { AssistantPage } from "./pages/Assistant";
import { CropHealthPage } from "./pages/CropHealth";
import { CropIntelligencePage } from "./pages/CropIntelligence";
import { DashboardPage } from "./pages/Dashboard";
import { DataSourcesPage } from "./pages/DataSources";
import { ExploreMapPage } from "./pages/ExploreMap";
import { FarmerGuidePage } from "./pages/FarmerGuide";
import { FieldListPage } from "./pages/FieldList";
import { FieldSetupPage } from "./pages/FieldSetup";
import { ForFarmersPage } from "./pages/ForFarmers";
import { GuidePage } from "./pages/Guide";
import { HomePage } from "./pages/Home";
import { IrrigationPage } from "./pages/Irrigation";
import { LocationAnalysisPage } from "./pages/LocationAnalysis";
import { NotFoundPage } from "./pages/NotFound";
import { SatellitePage } from "./pages/Satellite";
import { RayyanChatPage } from "./rayyan/ChatPage";
import { RayyanSettingsPage } from "./rayyan/SettingsPage";

/** Reset scroll on navigation, but preserve anchored deep links from the landing page. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="fields" element={<FieldListPage />} />
          <Route path="fields/new" element={<FieldSetupPage />} />
          <Route path="explore" element={<ExploreMapPage />} />
          <Route path="location" element={<LocationAnalysisPage />} />
          <Route path="crop" element={<CropIntelligencePage />} />
          <Route path="farmer" element={<ForFarmersPage />} />
          <Route path="data-sources" element={<DataSourcesPage />} />
          <Route path="farmer-guide" element={<FarmerGuidePage />} />
          <Route path="guide" element={<GuidePage />} />
          <Route path="dashboard/:fieldId" element={<DashboardPage />} />
          <Route path="analytics/:fieldId" element={<AnalyticsPage />} />
          <Route path="irrigation/:fieldId" element={<IrrigationPage />} />
          <Route path="health/:fieldId" element={<CropHealthPage />} />
          <Route path="satellite/:fieldId" element={<SatellitePage />} />
          <Route path="assistant/:fieldId" element={<AssistantPage />} />
          <Route path="rayyan" element={<RayyanChatPage />} />
          <Route path="rayyan/settings" element={<RayyanSettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
