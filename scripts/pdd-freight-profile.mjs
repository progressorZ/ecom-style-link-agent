import {compileFreightPlan} from './pdd-freight.mjs'

// External shop configuration stays separate from reusable product facts.
// Confirmation is an input assertion, never proof of current browser identity.
export function resolveFreightProfile(listing, profiles) {
  if (!Array.isArray(profiles)) throw new Error('FREIGHT_PROFILES_INVALID')
  const matches = profiles.filter(p => p?.platform === listing.platform &&
    p.shopKey === listing.shopKey && p.profileKey === listing.logistics?.profileKey)
  if (matches.length > 1) throw new Error('FREIGHT_PROFILE_AMBIGUOUS')
  if (!matches.length) return null
  const profile = structuredClone(matches[0])
  const text = s => typeof s === 'string' && s.length > 0 && s.trim() === s
  if (profile.version !== 'pdd-freight-profile-v1' ||
      !Number.isSafeInteger(profile.revision) || profile.revision < 1 ||
      !text(profile.shopKey) || !text(profile.profileKey) ||
      profile.confirmation?.confirmed !== true || !text(profile.confirmation?.reference) ||
      !text(profile.confirmation?.confirmedAt) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(profile.confirmation.confirmedAt) ||
      !Number.isFinite(Date.parse(profile.confirmation.confirmedAt)) ||
      !profile.freight || Object.keys(profile.freight).some(k => !['mode','templateName','expectedGroups'].includes(k))) {
    throw new Error('FREIGHT_PROFILE_UNCONFIRMED_OR_INVALID')
  }
  const freight = compileFreightPlan({scope:'pdd-tshirt-freight-v1', productCode:'PROFILE-VALIDATION', ...profile.freight})
  return {
    version:profile.version, platform:profile.platform, shopKey:profile.shopKey,
    profileKey:profile.profileKey, revision:profile.revision,
    confirmation:{confirmed:true, confirmedAt:profile.confirmation.confirmedAt, reference:profile.confirmation.reference},
    freight:{mode:freight.mode, templateName:freight.templateName, expectedGroups:freight.expectedGroups}
  }
}
