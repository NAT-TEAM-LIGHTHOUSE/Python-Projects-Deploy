import { useSearchParams } from "react-router-dom";
import EmbedDashboard from "./EmbedDashboard";

const EmbedDashboardPage = () => {
  const [searchParams] = useSearchParams();

  const payloadIdentifier = {
    appkey: searchParams.get("appkey") || undefined,
    wma_object_code: searchParams.get("wma_object_code") || undefined,
    app_page_frame_seqid: searchParams.get("app_page_frame_seqid") || undefined,
    iud_seqid: searchParams.get("iud_seqid") || undefined,
    user_code: searchParams.get("user_code") || undefined,
  };

  return <EmbedDashboard payloadIdentifier={payloadIdentifier} />;
};

export default EmbedDashboardPage;