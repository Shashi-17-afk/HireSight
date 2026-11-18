import { z } from 'zod';

// Reusable helper: turns empty string into null before URL validation so users
// who clear a field don't get a spurious "Invalid url" error.
const optionalUrl = z
	.string()
	.transform((v) => (v.trim() === '' ? null : v.trim()))
	.pipe(z.string().url('Must be a full URL starting with https://').nullable())
	.nullable()
	.optional();

const optionalText = (max: number) =>
	z
		.string()
		.max(max)
		.transform((v) => (v.trim() === '' ? null : v.trim()))
		.nullable()
		.optional();

export const profileBodySchema = z.object({
	phone:               z.string().min(7, 'Phone too short').max(20, 'Phone too long').transform(v => v.trim()).nullable().optional(),
	linkedin_url:        optionalUrl,
	github_url:          optionalUrl,
	portfolio_url:       optionalUrl,
	resume_url:          optionalUrl,
	headline:            optionalText(120),
	bio:                 optionalText(1000),
	location:            optionalText(100),
	years_of_experience: z.number().int().min(0).max(60).nullable().optional(),
	skills:              optionalText(500),
	availability:        z.enum(['immediate', '2_weeks', '1_month', 'not_looking']).nullable().optional(),
	preferred_role_type: z.enum(['full_time', 'part_time', 'contract', 'remote']).nullable().optional(),
	expected_salary:     optionalText(100),
});

export type ProfileBody = z.infer<typeof profileBodySchema>;
