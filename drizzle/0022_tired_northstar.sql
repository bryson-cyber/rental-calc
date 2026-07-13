DELETE t1 FROM `email_send_log` t1
INNER JOIN `email_send_log` t2
  ON t1.`webinarId` = t2.`webinarId`
 AND t1.`registrantId` = t2.`registrantId`
 AND t1.`emailType` = t2.`emailType`
 AND t1.`id` > t2.`id`;--> statement-breakpoint
ALTER TABLE `email_send_log` ADD CONSTRAINT `email_log_claim_uq` UNIQUE(`webinarId`,`registrantId`,`emailType`);