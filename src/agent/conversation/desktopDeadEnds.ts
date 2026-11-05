// A program that wants an account, an activation or a licence: she cannot get past it (and must
// not sign in for the user). With an unlicensed Excel she retried for 40+ steps instead of saying
// so (benchmark 2026-11-05).
export const SIGN_IN_WALL = /(?:未经授权|未激活|产品密钥|激活(?:产品|此产品|向导|Office|Windows)|登录以(?:设置|激活|使用)|许可证(?:已过期|无效)|试用(?:期)?已(?:过期|结束)|unlicensed|product\s*key|product\s*activation|activate\s+(?:office|windows|this\s+product)|licen[cs]e\s+(?:expired|required)|sign\s+in\s+to\s+(?:set\s*up|activate))/iu;
// A window titled just "登录" / "Sign in" / "登录 - 某软件", not a file named 登录记录.txt.
export const SIGN_IN_TITLE = /^\s*(?:登录|登入|sign\s*in|log\s*in)(?=\s*(?:$|[-–—|:：(（]))/iu;
export const FAILED_RESULT = /^(?:结果：失败|失败|没有找到窗口|最新清单里没有|看不懂位置|还不知道在哪个窗口|用户拒绝)/u;
export const FAILURES_BEFORE_STOP = 3;
