import { createHash } from "node:crypto";

declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

const serviceLabels: Record<string, string> = {
  cfo: "Fractional CFO / Controller",
  bookkeeping: "Bookkeeping",
  tax: "Tax compliance & planning",
  tax_notice: "Tax notice / controversy",
  sales_tax: "Sales tax compliance",
  ptet_bait: "PTET / NJ BAIT review",
  other: "Other"
};

const locationLabels: Record<string, string> = {
  ny: "New York",
  nj: "New Jersey",
  other_us: "Other U.S. location",
  outside_us: "Outside the U.S."
};

type SubscribePayload = {
  email?: string;
  name?: string;
  company?: string;
  location?: string;
  serviceInterest?: string[];
  mailingListOptIn?: boolean;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function requiredEnv(name: string) {
  const value = Netlify.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function splitName(name: string): Record<string, string> {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { FNAME: parts[0] };
  return {
    FNAME: parts.slice(0, -1).join(" "),
    LNAME: parts[parts.length - 1]
  };
}

function memberHash(email: string) {
  return createHash("md5").update(email.toLowerCase()).digest("hex");
}

function authHeader(apiKey: string) {
  return `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;
}

function buildTags(payload: SubscribePayload) {
  const tags = new Set<string>(["Website Contact Form"]);
  const location = cleanText(payload.location);
  if (location && locationLabels[location]) {
    tags.add(`Location: ${locationLabels[location]}`);
  }
  for (const service of payload.serviceInterest || []) {
    if (serviceLabels[service]) {
      tags.add(`Service: ${serviceLabels[service]}`);
    }
  }
  return Array.from(tags);
}

export default async (request: Request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let payload: SubscribePayload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "Invalid request body." }, 400);
  }

  if (!payload.mailingListOptIn) {
    return json({ status: "skipped" });
  }

  const email = cleanText(payload.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "A valid email address is required." }, 400);
  }

  try {
    const apiKey = requiredEnv("MAILCHIMP_API_KEY");
    const serverPrefix = Netlify.env.get("MAILCHIMP_SERVER_PREFIX") || apiKey.split("-").pop();
    const audienceId = requiredEnv("MAILCHIMP_AUDIENCE_ID");
    const subscribeStatus = Netlify.env.get("MAILCHIMP_SUBSCRIBE_STATUS") || "pending";

    if (!serverPrefix) {
      throw new Error("MAILCHIMP_SERVER_PREFIX is not configured.");
    }

    if (!["pending", "subscribed"].includes(subscribeStatus)) {
      throw new Error("MAILCHIMP_SUBSCRIBE_STATUS must be pending or subscribed.");
    }

    const baseUrl = `https://${serverPrefix}.api.mailchimp.com/3.0`;
    const headers = {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json"
    };
    const hash = memberHash(email);
    const mergeFields = splitName(cleanText(payload.name));
    const company = cleanText(payload.company);
    if (company) {
      mergeFields.COMPANY = company;
    }

    const memberResponse = await fetch(`${baseUrl}/lists/${audienceId}/members/${hash}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        email_address: email,
        status_if_new: subscribeStatus,
        merge_fields: mergeFields
      })
    });

    const member = await memberResponse.json().catch(() => ({}));
    if (!memberResponse.ok) {
      console.error("Mailchimp member update failed", {
        status: memberResponse.status,
        title: member.title,
        detail: member.detail
      });
      return json({ error: "Mailing list signup could not be completed." }, 502);
    }

    const tags = buildTags(payload);
    if (tags.length) {
      const tagResponse = await fetch(`${baseUrl}/lists/${audienceId}/members/${hash}/tags`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tags: tags.map((name) => ({ name, status: "active" }))
        })
      });

      if (!tagResponse.ok) {
        const tagError = await tagResponse.json().catch(() => ({}));
        console.error("Mailchimp tag update failed", {
          status: tagResponse.status,
          title: tagError.title,
          detail: tagError.detail
        });
      }
    }

    return json({
      status: "ok",
      mailchimpStatus: member.status,
      doubleOptIn: subscribeStatus === "pending"
    });
  } catch (error) {
    console.error("Mailchimp subscribe configuration error", error);
    return json({ error: "Mailing list signup is not configured." }, 500);
  }
};

export const config = {
  path: "/api/mailchimp-subscribe",
  method: ["POST"]
};
