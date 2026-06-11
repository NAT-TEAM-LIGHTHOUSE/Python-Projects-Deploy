import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function DbLoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/web/agentai/process_gpt", { replace: true });
  }, [navigate]);

  return null;
}

export default DbLoginPage;
