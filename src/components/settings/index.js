import PropTypes from 'prop-types';
import ThemeContrast from '@/components/settings/ThemeContrast';
import ThemeRtlLayout from '@/components/settings/ThemeRtlLayout';
import ThemeColorPresets from '@/components/settings/ThemeColorPresets';
import ThemeLocalization from '@/components/settings/ThemeLocalization';

// ----------------------------------------------------------------------

ThemeSettings.propTypes = {
  children: PropTypes.node.isRequired,
};

export default function ThemeSettings({ children }) {
  return (
    <ThemeColorPresets>
      <ThemeContrast>
        <ThemeLocalization>
          <ThemeRtlLayout>
            {children}
            {/* <SettingsDrawer /> */}
          </ThemeRtlLayout>
        </ThemeLocalization>
      </ThemeContrast>
    </ThemeColorPresets>
  );
}
