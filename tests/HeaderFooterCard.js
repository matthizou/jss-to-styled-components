import React from 'react' // eslint-disable-line
import PropTypes from 'prop-types'
import cn from 'classnames'
import injectSheet from 'react-jss'
import { Card } from '@xingternal/360-components'

const styles = {
  card: {
    composes: 'mx-auto my8',
    maxWidth: 984,
    minWidth: 790,
  },
  footer: { composes: 'border-top border-gray-15 blah' },
}

const HeaderFooterCard = ({ id, className, classes, header, footer }) => (
  <Card id={id} className={cn(classes.card, className)}>
    {header}
    <div className={classes.footer}>{footer}</div>
  </Card>
)

HeaderFooterCard.propTypes = {
  /** Unique id attribute */
  id: PropTypes.string,
  /** Additional class names */
  className: PropTypes.string,
  /** Element rendered on the header section */
  header: PropTypes.node.isRequired,
  /** Element rendered on the footer section */
  footer: PropTypes.node,
}

export default injectSheet(styles)(HeaderFooterCard)
