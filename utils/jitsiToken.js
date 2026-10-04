import jwt from "jsonwebtoken";

/*
  Env (self-hosted Jitsi with token auth, or any server using HS256 tokens):
    JITSI_DOMAIN       e.g. meet.yourschool.edu.ng   (do NOT use meet.jit.si in production:
                       embedded calls there are cut off after 5 minutes)
    JITSI_APP_ID       must match the Jitsi server's app_id
    JITSI_APP_SECRET   must match the Jitsi server's app_secret
    JITSI_AUDIENCE     optional, defaults to "jitsi"
  If APP_ID/SECRET are not set, rooms are open (anyone with the room name can join).
*/
export const buildJoinInfo = ({ roomName, userId, name, email, moderator }) => {
  const domain = process.env.JITSI_DOMAIN || "meet.jit.si";
  const appId = process.env.JITSI_APP_ID;
  const secret = process.env.JITSI_APP_SECRET;

  const info = {
    domain,
    roomName,
    displayName: name,
    moderator: Boolean(moderator),
    jwt: null,
    // frontend can show a warning while on the public demo server
    embedLimited: domain === "meet.jit.si",
  };

  if (appId && secret) {
    info.jwt = jwt.sign(
      {
        aud: process.env.JITSI_AUDIENCE || "jitsi",
        iss: appId,
        sub: domain,
        room: roomName,
        context: { user: { id: String(userId), name, email: email || "", moderator: Boolean(moderator) } },
      },
      secret,
      { expiresIn: "6h" }
    );
  }
  return info;
};
