import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/**
 * Legacy redirect: sends old /pagamento URLs to /preview,
 * preserving query params like ?coupon=, ?admin=, ?paid=true, ?upsell=true
 */
export default function Payment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    navigate(`/preview${params ? `?${params}` : ""}`, { replace: true });
  }, [navigate, searchParams]);

  return null;
}
